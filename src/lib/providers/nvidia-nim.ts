import type { NIMChatCompletionRequest, NIMStreamChunk, Message, ContentBlock, ToolDefinition, ToolCall } from '@/types';
import { selectMessagesForContext } from './context-truncation';

export class NIMChatClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private proxyUrl: string;

  constructor(apiKey: string, baseUrl: string, model: string, proxyUrl?: string) {
    this.apiKey = apiKey;
    let url = baseUrl.trim().replace(/\/$/, '');
    url = url.replace(/\/chat\/completions$/, '');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    this.baseUrl = url;
    this.model = model;
    this.proxyUrl = proxyUrl || '';
  }

  private convertMessages(
    messages: Message[],
    systemPrompt: string,
    userProfileText: string
  ): NIMChatCompletionRequest['messages'] {
    const result: NIMChatCompletionRequest['messages'] = [];

    const systemParts: string[] = [];
    if (systemPrompt) systemParts.push(systemPrompt);
    if (userProfileText) systemParts.push(`\n---\nUser profile:\n${userProfileText}`);

    if (systemParts.length > 0) {
      result.push({ role: 'user', content: `[System context]\n${systemParts.join('\n\n')}` });
      result.push({ role: 'assistant', content: 'Understood. I will follow these instructions.' });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        const imageAttachments = msg.attachments?.filter(att => att.type === 'image') || [];
        let content: string | ContentBlock[];
        if (imageAttachments.length > 0) {
          const blocks: ContentBlock[] = [];
          if (msg.content) blocks.push({ type: 'text', text: msg.content });
          blocks.push(...imageAttachments.map(att => ({
            type: 'image_url' as const,
            image_url: { url: att.url }
          })));
          content = blocks;
        } else {
          content = msg.content;
        }
        result.push({ role: 'user', content });
      } else if (msg.role === 'assistant') {
        result.push({ role: 'assistant', content: msg.content });
      } else if ((msg as any).role === 'tool') {
        result.push({ role: 'tool', content: msg.content, tool_call_id: (msg as any).toolCallId });
      }
    }

    return result;
  }

  private async post(request: NIMChatCompletionRequest): Promise<any> {
    const targetUrl = `${this.baseUrl}/chat/completions`;
    const url = this.proxyUrl || targetUrl;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    if (this.proxyUrl) headers['X-Target-Url'] = targetUrl;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: request.stream ? undefined : (this as any)._abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status} for ${targetUrl}: ${errorText}`);
    }

    return response;
  }

  async chat(
    messages: Message[],
    options: {
      systemPrompt?: string;
      userProfileText?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      onChunk?: (content: string) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
      abortSignal?: AbortSignal;
      tools?: ToolDefinition[];
      onToolCall?: (toolCall: ToolCall) => Promise<string>;
    }
  ): Promise<string> {
    const {
      systemPrompt = '', userProfileText = '', temperature,
      maxTokens = 2048, stream, onChunk, onComplete, onError,
      abortSignal, tools, onToolCall
    } = options;

    (this as any)._abortSignal = abortSignal;

    try {
      const truncatedMessages = selectMessagesForContext(
        messages, systemPrompt, userProfileText, maxTokens
      );

      const apiMessages = this.convertMessages(truncatedMessages, systemPrompt, userProfileText);

      if (!tools || tools.length === 0) {
        return this.singleRound(apiMessages, { model: this.model, temperature, max_tokens: maxTokens }, stream ?? false, onChunk, onComplete);
      }

      try {
        return await this.toolLoop(apiMessages, { model: this.model, temperature, max_tokens: maxTokens, tools }, stream ?? false, onChunk, onComplete, onToolCall!);
      } catch {
        return this.singleRound(apiMessages, { model: this.model, temperature, max_tokens: maxTokens }, stream ?? false, onChunk, onComplete);
      }
    } catch (err) {
      if (err instanceof TypeError && (err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
        const msg = `Cannot reach ${this.baseUrl}. Ensure the app is served through the Docker server (port 3000).`;
        onError?.(new Error(msg));
        throw err;
      }
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private async singleRound(
    apiMessages: NIMChatCompletionRequest['messages'],
    base: { model: string; temperature?: number; max_tokens?: number },
    wantsStream: boolean,
    onChunk?: (content: string) => void,
    onComplete?: () => void
  ): Promise<string> {
    const request: NIMChatCompletionRequest = {
      ...base,
      messages: apiMessages,
      stream: wantsStream,
    };

    const response = await this.post(request);

    if (wantsStream && onChunk) {
      return this.readStream(response, onChunk, onComplete);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    onComplete?.();
    return content;
  }

  private parseDSMLToolCalls(content: string): { toolCalls: ToolCall[]; cleanedContent: string } {
    const toolCalls: ToolCall[] = [];
    // Handle both <DSML｜invoke> and <｜DSML｜invoke> (DeepSeek variations)
    const regex = /<(?:｜)?DSML｜invoke name="([^"]+)"[^>]*>\s*([\s\S]*?)<\/(?:｜)?DSML｜invoke>/g;
    let cleaned = content;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1] || '';
      const paramsBody = match[2] || '';
      const args: Record<string, string> = {};
      const paramRegex = /<(?:｜)?DSML｜parameter name="([^"]+)"[^>]*>([\s\S]*?)<\/(?:｜)?DSML｜parameter>/g;
      let pm;
      while ((pm = paramRegex.exec(paramsBody)) !== null) {
        const key = pm[1];
        const val = pm[2];
        if (key) args[key] = val || '';
      }
      toolCalls.push({
        id: `dsml_${toolCalls.length}_${Date.now()}`,
        type: 'function',
        function: { name, arguments: JSON.stringify(args) },
      });
      cleaned = cleaned.replace(match[0], '').trim();
    }

    // Also strip any <(?:)?DSML｜tool_calls> wrapper tags
    cleaned = cleaned.replace(/<(?:｜)?DSML｜tool_calls>/g, '').replace(/<\/(?:｜)?DSML｜tool_calls>/g, '').trim();

    return { toolCalls, cleanedContent: cleaned };
  }

  private async toolLoop(
    apiMessages: NIMChatCompletionRequest['messages'],
    base: { model: string; temperature?: number; max_tokens?: number; tools: ToolDefinition[] },
    wantsStream: boolean,
    onChunk?: (content: string) => void,
    onComplete?: () => void,
    onToolCall?: (tc: ToolCall) => Promise<string>
  ): Promise<string> {
    let messages = [...apiMessages];
    let accumulatedContent = '';

    for (let round = 0; round < 10; round++) {
      const req: NIMChatCompletionRequest = {
        model: base.model,
        messages,
        temperature: base.temperature,
        max_tokens: base.max_tokens,
        stream: false,
      };
      if (round === 0) req.tools = base.tools;

      const response = await this.post(req);
      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error('No response from API');

      let rawContent = choice.message?.content || '';
      const toolCalls: ToolCall[] | undefined = choice.message?.tool_calls;

      const hasDSML = rawContent.includes('<DSML｜') || rawContent.includes('<｜DSML｜');
      const parsedDSML = hasDSML ? this.parseDSMLToolCalls(rawContent) : null;

      if (parsedDSML && parsedDSML.toolCalls.length > 0) {
        accumulatedContent += parsedDSML.cleanedContent;

        messages.push({
          role: 'assistant',
          content: parsedDSML.cleanedContent || null,
        });

        for (const tc of parsedDSML.toolCalls) {
          const result = await onToolCall!(tc);
          messages.push({
            role: 'user',
            content: `[Search results]\n${result}\n\n[Use the above search results to answer the user's question. Cite sources by name.]`,
          });
        }
        continue;
      }

      if (toolCalls && toolCalls.length > 0) {
        accumulatedContent += rawContent;

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          const result = await onToolCall!(tc);
          messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
        }
        continue;
      }

      accumulatedContent += rawContent;
      const finalContent = accumulatedContent;

      if (wantsStream && onChunk) {
        let pos = 0;
        while (pos < finalContent.length) {
          const end = Math.min(pos + 15, finalContent.length);
          onChunk(finalContent.slice(pos, end));
          pos = end;
        }
      }

      onComplete?.();
      return finalContent;
    }

    throw new Error('Tool call loop exceeded max rounds');
  }

  private async readStream(
    response: Response,
    onChunk: (content: string) => void,
    onComplete?: () => void
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '' && line.startsWith('data: '));

      for (const line of lines) {
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const parsed: NIMStreamChunk = JSON.parse(raw);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch {
          // skip malformed
        }
      }
    }

    onComplete?.();
    return fullContent;
  }

  async summarizeHistory(messages: Message[], userProfileText: string): Promise<string> {
    const slice = messages.slice(-20);
    const summaryRequest = slice.length > 0 ? slice : messages;
    try {
      return await this.chat(summaryRequest, {
        systemPrompt: 'Summarize the following conversation concisely, preserving key facts, decisions, preferences, and user context. Focus on information needed for future responses.',
        userProfileText,
        temperature: 0.3,
        maxTokens: 512,
        stream: false,
      });
    } catch {
      return '';
    }
  }
}

export function createNIMClient(apiKey: string, baseUrl: string, model: string): NIMChatClient {
  return new NIMChatClient(apiKey, baseUrl, model, '/api/proxy');
}
