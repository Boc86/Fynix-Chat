import type { NIMChatCompletionRequest, NIMStreamChunk, Message, ContentBlock } from '@/types';

export class NIMChatClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private proxyUrl: string;

  constructor(apiKey: string, baseUrl: string, model: string, proxyUrl?: string) {
    this.apiKey = apiKey;
    let url = baseUrl.trim().replace(/\/$/, '');
    url = url.replace(/\/chat\/completions$/, '');
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    this.baseUrl = url;
    this.model = model;
    this.proxyUrl = proxyUrl || '';
  }

  private convertMessages(messages: Message[], systemPrompt?: string): NIMChatCompletionRequest['messages'] {
    const result: NIMChatCompletionRequest['messages'] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        const imageAttachments = msg.attachments?.filter(att => att.type === 'image') || [];

        let content: string | ContentBlock[];
        if (imageAttachments.length > 0) {
          const blocks: ContentBlock[] = [];
          if (msg.content) {
            blocks.push({ type: 'text', text: msg.content });
          }
          blocks.push(...imageAttachments.map(att => ({
            type: 'image_url' as const,
            image_url: { url: att.url }
          })));
          content = blocks;
        } else {
          content = msg.content;
        }

        result.push({
          role: 'user',
          content
        });
      } else if (msg.role === 'assistant') {
        result.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    return result;
  }

  async chat(
    messages: Message[],
    options: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      onChunk?: (content: string) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<string> {
    const { systemPrompt, temperature, maxTokens, stream, onChunk, onComplete, onError, abortSignal } = options;

    const request: NIMChatCompletionRequest = {
      model: this.model,
      messages: this.convertMessages(messages, systemPrompt),
      temperature,
      max_tokens: maxTokens,
      stream: stream ?? false
    };

    const targetUrl = `${this.baseUrl}/chat/completions`;
    const url = this.proxyUrl || targetUrl;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };

    if (this.proxyUrl) {
      headers['X-Target-Url'] = targetUrl;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: abortSignal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status} for ${targetUrl}: ${errorText}`);
      }

      if (stream && onChunk) {
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
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed: NIMStreamChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        onComplete?.();
        return fullContent;
      } else {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        onComplete?.();
        return content;
      }
    } catch (err) {
      if (err instanceof TypeError && (err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
        const msg = `Cannot reach ${targetUrl}. If the API does not support CORS, ensure the app is served through the Docker server (port 3000).`;
        onError?.(new Error(msg));
        throw err;
      }
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }
}

export function createNIMClient(apiKey: string, baseUrl: string, model: string): NIMChatClient {
  return new NIMChatClient(apiKey, baseUrl, model, '/api/proxy');
}
