import type { NIMChatCompletionRequest, NIMStreamChunk, Message, ContentBlock } from '@/types';

export class NIMChatClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.apiKey = apiKey;
    let url = baseUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    this.baseUrl = url;
    this.model = model;
  }

  private convertMessages(messages: Message[], systemPrompt?: string): NIMChatCompletionRequest['messages'] {
    const result: NIMChatCompletionRequest['messages'] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        const content: string | ContentBlock[] = msg.attachments?.length
          ? msg.attachments.map(att => ({
              type: 'image_url' as const,
              image_url: { url: att.url }
            }))
          : msg.content;

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

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(request),
        signal: abortSignal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status} for ${this.baseUrl}/chat/completions: ${errorText}`);
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
      const msg = err instanceof Error ? err.message : String(err);
      const detail = msg.includes('NetworkError') || msg.includes('Failed to fetch')
        ? `Cannot reach ${this.baseUrl}/chat/completions. Check the URL in Settings.`
        : msg;
      onError?.(new Error(detail));
      throw err;
    }
  }
}

export function createNIMClient(apiKey: string, baseUrl: string, model: string): NIMChatClient {
  return new NIMChatClient(apiKey, baseUrl, model);
}