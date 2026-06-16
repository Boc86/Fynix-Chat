import type { NIMChatCompletionRequest, NIMStreamChunk, Message, ContentBlock } from '@/types';
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
    }
  ): Promise<string> {
    const {
      systemPrompt = '', userProfileText = '', temperature,
      maxTokens = 2048, stream, onChunk, onComplete, onError,
      abortSignal
    } = options;

    (this as any)._abortSignal = abortSignal;

    try {
      const truncatedMessages = selectMessagesForContext(
        messages, systemPrompt, userProfileText, maxTokens
      );

      const apiMessages = this.convertMessages(truncatedMessages, systemPrompt, userProfileText);

      return this.singleRound(apiMessages, { model: this.model, temperature, max_tokens: maxTokens }, stream ?? false, onChunk, onComplete);
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
