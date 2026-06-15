import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase, defaultPreferences, defaultPersona, generateId, type StoredPreferences, type StoredPersona, type StoredApiConfig, type StoredConversation } from '@/lib/storage';
import type { Message, Conversation } from '@/types';

export function useConversations() {
  const conversations = useLiveQuery(() =>
    db.conversations.orderBy('updatedAt').reverse().toArray()
  );

  const activeConversationId = useLiveQuery(() =>
    db.activeConversation.get('active')
  );

  const createConversation = useCallback(async (title?: string): Promise<string> => {
    const id = generateId();
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
  }, []);

  const updateConversation = useCallback(async (id: string, updates: Partial<StoredConversation>) => {
    await db.conversations.update(id, { ...updates, updatedAt: Date.now() });
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await db.conversations.delete(id);
    const active = await db.activeConversation.get('active');
    if (active?.conversationId === id) {
      const remaining = await db.conversations.orderBy('updatedAt').reverse().first();
      await db.activeConversation.update('active', { conversationId: remaining?.id || null });
    }
  }, []);

  const setActiveConversation = useCallback(async (id: string | null) => {
    await db.activeConversation.update('active', { conversationId: id });
  }, []);

  const getConversation = useCallback(async (id: string): Promise<Conversation | null> => {
    const stored = await db.conversations.get(id);
    if (!stored) return null;
    return {
      ...stored,
      messages: JSON.parse(stored.messages) as Message[]
    };
  }, []);

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

  const updatePersona = useCallback(async (updates: Partial<StoredPersona>) => {
    await db.personas.update('default', updates);
  }, []);

  const resetPersona = useCallback(async () => {
    await db.personas.put({ ...defaultPersona });
  }, []);

  return {
    persona: persona || defaultPersona,
    updatePersona,
    resetPersona
  };
}

export function usePreferences() {
  const prefs = useLiveQuery(() => db.preferences.get('user-preferences'));

  const updatePreferences = useCallback(async (updates: Partial<StoredPreferences>) => {
    await db.preferences.update('user-preferences', updates);
  }, []);

  const resetPreferences = useCallback(async () => {
    await db.preferences.put(defaultPreferences);
  }, []);

  return {
    preferences: prefs || defaultPreferences,
    updatePreferences,
    resetPreferences
  };
}

export function useApiConfigs() {
  const configs = useLiveQuery(() => db.apiConfigs.toArray());

  const addApiConfig = useCallback(async (config: Omit<StoredApiConfig, 'id'>) => {
    const id = generateId();
    await db.apiConfigs.add({ ...config, id });
    return id;
  }, []);

  const updateApiConfig = useCallback(async (id: string, updates: Partial<StoredApiConfig>) => {
    await db.apiConfigs.update(id, updates);
  }, []);

  const deleteApiConfig = useCallback(async (id: string) => {
    await db.apiConfigs.delete(id);
  }, []);

  const setDefaultConfig = useCallback(async (id: string) => {
    await db.apiConfigs.toCollection().modify({ isDefault: false });
    await db.apiConfigs.update(id, { isDefault: true });
  }, []);

  return {
    configs: configs || [],
    addApiConfig,
    updateApiConfig,
    deleteApiConfig,
    setDefaultConfig
  };
}

export { initializeDatabase };