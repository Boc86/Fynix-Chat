import Dexie, { type Table } from 'dexie';

export interface StoredConversation {
  id: string;
  title: string;
  messages: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredPersona {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface StoredPreferences {
  id: string;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  streaming: boolean;
  soundEnabled: boolean;
  streamDebounceMs: number;
}

export interface StoredApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
}

export interface StoredActiveConversation {
  id: string;
  conversationId: string | null;
}

class ChatDatabase extends Dexie {
  conversations!: Table<StoredConversation>;
  personas!: Table<StoredPersona>;
  preferences!: Table<StoredPreferences>;
  apiConfigs!: Table<StoredApiConfig>;
  activeConversation!: Table<StoredActiveConversation>;

  constructor() {
    super('nim-chat');
    this.version(1).stores({
      conversations: 'id, title, createdAt, updatedAt',
      personas: 'id',
      preferences: 'id',
      apiConfigs: 'id, isDefault',
      activeConversation: 'id'
    });
  }
}

export const db = new ChatDatabase();

export const defaultPreferences: StoredPreferences = {
  id: 'user-preferences',
  theme: 'system',
  fontSize: 'medium',
  streaming: true,
  soundEnabled: true,
  streamDebounceMs: 50
};

export const defaultPersona: StoredPersona = {
  id: 'default',
  name: 'Chat Assistant',
  description: 'A helpful AI assistant',
  systemPrompt: 'You are a helpful, friendly, and knowledgeable AI assistant. Provide accurate and concise responses.',
  temperature: 0.7,
  maxTokens: 2048
};

export async function initializeDatabase() {
  const prefs = await db.preferences.get('user-preferences');
  if (!prefs) {
    await db.preferences.put(defaultPreferences);
  }

  const personas = await db.personas.get('default');
  if (!personas) {
    await db.personas.put(defaultPersona);
  }

  const active = await db.activeConversation.get('active');
  if (!active) {
    await db.activeConversation.put({ id: 'active', conversationId: null });
  }
}