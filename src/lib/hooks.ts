import { useState, useEffect, useCallback } from 'react';
import type { Message, Conversation, Persona, UserProfile, ApiConfig, LibraryFile } from '@/types';
import * as api from '@/lib/api';

// ── Conversations ──
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchConversations().then(list => {
      setConversations(list);
    }).catch(console.error).finally(() => setLoading(false));

    api.fetchActiveState().then(state => {
      setActiveConversationId(state.conversationId);
    }).catch(console.error);
  }, []);

  const createConversation = useCallback(async (title?: string): Promise<string> => {
    const { id } = await api.createConversation({ title });
    await api.setActiveConversation(id);
    setActiveConversationId(id);
    const updated = await api.fetchConversations();
    setConversations(updated);
    return id;
  }, []);

  const updateConversation = useCallback(async (id: string, updates: { title?: string; summary?: string; messages?: Message[] }) => {
    await api.updateConversation(id, updates);
    const updated = await api.fetchConversations();
    setConversations(updated);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    const remaining = (await api.fetchConversations()).filter(c => c.id !== id);
    setConversations(remaining);
    const active = await api.fetchActiveState();
    if (active.conversationId === id) {
      const nextId = remaining[0]?.id || null;
      await api.setActiveConversation(nextId);
      setActiveConversationId(nextId);
    }
  }, []);

  const setActiveConversationFn = useCallback(async (id: string | null) => {
    await api.setActiveConversation(id);
    setActiveConversationId(id);
  }, []);

  const getConversation = useCallback(async (id: string): Promise<Conversation | null> => {
    try {
      return await api.fetchConversation(id);
    } catch (err) {
      console.warn('Failed to load conversation', id, err);
      return null;
    }
  }, []);

  return {
    conversations,
    activeConversationId,
    loading,
    createConversation,
    updateConversation,
    deleteConversation,
    setActiveConversation: setActiveConversationFn,
    getConversation
  };
}

// ── Personas ──
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchPersonas().then(list => {
      setPersonas(list);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const addPersona = useCallback(async (data: { name: string; description?: string; systemPrompt?: string; temperature?: number; maxTokens?: number }): Promise<string> => {
    const { id } = await api.createPersona(data);
    const updated = await api.fetchPersonas();
    setPersonas(updated);
    return id;
  }, []);

  const updatePersona = useCallback(async (id: string, updates: Partial<Persona>) => {
    await api.updatePersona(id, updates);
    setPersonas(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePersona = useCallback(async (id: string) => {
    await api.deletePersona(id);
    setPersonas(prev => prev.filter(p => p.id !== id));
  }, []);

  const getPersonaById = useCallback((id: string): Persona | undefined => {
    return personas.find(p => p.id === id);
  }, [personas]);

  return {
    personas,
    loading,
    addPersona,
    updatePersona,
    deletePersona,
    getPersonaById
  };
}

// ── User Profile ──
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchUserProfile().then(p => {
      setProfile(p);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    await api.updateUserProfile(updates);
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return { profile, loading, updateProfile };
}

// ── Preferences ──
export function usePreferences() {
  const [preferences, setPreferences] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchPreferences().then(p => {
      setPreferences({
        ...p,
        streaming: !!p.streaming,
        soundEnabled: !!p.soundEnabled
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updatePreferences = useCallback(async (updates: any) => {
    await api.updatePreferences(updates);
    setPreferences(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const resetPreferences = useCallback(async () => {
    const defaults = { theme: 'system', fontSize: 'medium', streaming: true, soundEnabled: true, streamDebounceMs: 50 };
    await api.updatePreferences(defaults);
    setPreferences(defaults);
  }, []);

  return {
    preferences: preferences || { theme: 'system', fontSize: 'medium', streaming: true, soundEnabled: true, streamDebounceMs: 50 },
    loading,
    updatePreferences,
    resetPreferences
  };
}

// ── API Configs ──
export function useApiConfigs() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchConfigs().then(list => {
      setConfigs(list);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const addApiConfig = useCallback(async (data: Omit<ApiConfig, 'id'>) => {
    const { id } = await api.createConfig(data);
    const updated = await api.fetchConfigs();
    setConfigs(updated);
    return id;
  }, []);

  const updateApiConfig = useCallback(async (id: string, updates: Partial<ApiConfig>) => {
    await api.updateConfig(id, updates);
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteApiConfig = useCallback(async (id: string) => {
    await api.deleteConfig(id);
    setConfigs(prev => prev.filter(c => c.id !== id));
  }, []);

  const setDefaultConfig = useCallback(async (id: string) => {
    await api.updateConfig(id, { isDefault: true });
    for (const cfg of configs) {
      if (cfg.id !== id && cfg.isDefault) {
        await api.updateConfig(cfg.id, { isDefault: false });
      }
    }
    setConfigs(prev => prev.map(c => ({ ...c, isDefault: c.id === id })));
  }, [configs]);

  return {
    configs,
    loading,
    addApiConfig,
    updateApiConfig,
    deleteApiConfig,
    setDefaultConfig
  };
}

// ── File Library ──
export function useFileLibrary() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await api.fetchFiles();
      setFiles(list);
    } catch (err) {
      console.error('Failed to load files', err);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addFile = useCallback(async (file: File): Promise<LibraryFile> => {
    const result = await api.uploadFile(file);
    await refresh();
    return result;
  }, [refresh]);

  const removeFile = useCallback(async (id: string) => {
    await api.deleteFile(id);
    await refresh();
  }, [refresh]);

  return { files, loading, addFile, removeFile, refresh };
}
