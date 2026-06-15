import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase, defaultPreferences, defaultPersona, type StoredPreferences, type StoredPersona, type StoredApiConfig, type StoredConversation } from '@/lib/storage';
import type { Message, Conversation, Persona, UserPreferences, ApiConfig } from '@/types';

export function useConversations() {
  const conversations = useLiveQuery(() =>
    db.conversations.orderBy('updatedAt').reverse().toArray()
  );

  const activeConversationId = useLiveQuery(() =>
    db.activeConversation.get('active')
  );

  async function createConversation(title?: string): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const newConversation: StoredConversation = {
      id,
      title: title || `New Chat ${new Date().toLocaleDateString()}`,
      messages: '[]',
      createdAt: now,
      updatedAt: now
    };
    await db.conversations.add(newConversation);
    await db.activeConversation.update('active', { conversationId: id });
    return id;
  }

  async function updateConversation(id: string, updates: Partial<StoredConversation>) {
    await db.conversations.update(id, { ...updates, updatedAt: Date.now() });
  }

  async function deleteConversation(id: string) {
    await db.conversations.delete(id);
    const active = await db.activeConversation.get('active');
    if (active?.conversationId === id) {
      const remaining = await db.conversations.orderBy('updatedAt').reverse().first();
      await db.activeConversation.update('active', { conversationId: remaining?.id || null });
    }
  }

  async function setActiveConversation(id: string | null) {
    await db.activeConversation.update('active', { conversationId: id });
  }

  async function getConversation(id: string): Promise<Conversation | null> {
    const stored = await db.conversations.get(id);
    if (!stored) return null;
    return {
      ...stored,
      messages: JSON.parse(stored.messages) as Message[]
    };
  }

  return {
    conversations: conversations?.map(c => ({
      ...c,
      messages: JSON.parse(c.messages) as Message[]
    })) || [],
    activeConversationId: activeConversationId?.conversationId || null,
    createConversation,
    updateConversation,
    deleteConversation,
    setActiveConversation,
    getConversation
  };
}

export function usePersona() {
  const persona = useLiveQuery(() => db.personas.get('default'));

  async function updatePersona(updates: Partial<StoredPersona>) {
    await db.personas.update('default', updates);
  }

  async function resetPersona() {
    await db.personas.put({ ...defaultPersona });
  }

  return {
    persona: persona || defaultPersona,
    updatePersona,
    resetPersona
  };
}

export function usePreferences() {
  const prefs = useLiveQuery(() => db.preferences.get('user-preferences'));

  async function updatePreferences(updates: Partial<StoredPreferences>) {
    await db.preferences.update('user-preferences', updates);
  }

  async function resetPreferences() {
    await db.preferences.put(defaultPreferences);
  }

  return {
    preferences: prefs || defaultPreferences,
    updatePreferences,
    resetPreferences
  };
}

export function useApiConfigs() {
  const configs = useLiveQuery(() => db.apiConfigs.toArray());

  async function addApiConfig(config: Omit<StoredApiConfig, 'id'>) {
    const id = crypto.randomUUID();
    await db.apiConfigs.add({ ...config, id });
    return id;
  }

  async function updateApiConfig(id: string, updates: Partial<StoredApiConfig>) {
    await db.apiConfigs.update(id, updates);
  }

  async function deleteApiConfig(id: string) {
    await db.apiConfigs.delete(id);
  }

  async function setDefaultConfig(id: string) {
    await db.apiConfigs.toCollection().modify({ isDefault: false });
    await db.apiConfigs.update(id, { isDefault: true });
  }

  return {
    configs: configs || [],
    addApiConfig,
    updateApiConfig,
    deleteApiConfig,
    setDefaultConfig
  };
}

export { initializeDatabase };