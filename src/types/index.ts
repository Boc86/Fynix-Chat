export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  tokenEstimate?: number;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  url: string;
  size: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  summary?: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface UserProfile {
  id: string;
  content: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  streaming: boolean;
  soundEnabled: boolean;
  streamDebounceMs: number;
}

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface NIMChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface NIMChatCompletionRequest {
  model: string;
  messages: NIMChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
}

export interface NIMChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NIMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason?: string;
  }[];
}

export interface LibraryFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: number;
}

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
