import type { Message } from '@/types';

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const DEFAULT_MAX_CONTEXT_TOKENS = 128000;

export function selectMessagesForContext(
  messages: Message[],
  systemPrompt: string,
  userProfileText: string,
  maxResponseTokens: number,
  maxContextTokens: number = DEFAULT_MAX_CONTEXT_TOKENS
): Message[] {
  const systemTokens = estimateTokens(systemPrompt) + estimateTokens(userProfileText);
  const available = maxContextTokens - systemTokens - maxResponseTokens;

  if (available <= 0) return [];

  let totalTokens = 0;
  const selected: Message[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Message | undefined;
    if (!msg) break;

    const tokens = msg.tokenEstimate || estimateTokens(msg.content);
    if (totalTokens + tokens > available) {
      const remaining = available - totalTokens;
      if (remaining > 10 && i === messages.length - 1) {
        selected.unshift({
          id: msg.id,
          role: msg.role,
          content: msg.content.slice(0, remaining * 4),
          timestamp: msg.timestamp,
          attachments: msg.attachments,
          tokenEstimate: msg.tokenEstimate
        } as Message);
      }
      break;
    }
    totalTokens += tokens;
    selected.unshift(msg);
  }

  return selected;
}

export function buildUserProfileText(profile: { content?: string }): string {
  return profile.content?.trim() || '';
}
