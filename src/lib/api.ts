import { generateId } from './storage';
import type { Message, Persona, UserProfile, ApiConfig } from '@/types';

const BASE = '';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ── Personas ──
export async function fetchPersonas(): Promise<Persona[]> {
  return request('/api/personas');
}

export async function fetchPersona(id: string): Promise<Persona> {
  return request(`/api/personas/${id}`);
}

export async function createPersona(data: Partial<Persona>): Promise<{ id: string }> {
  return request('/api/personas', {
    method: 'POST',
    body: JSON.stringify({ id: generateId(), ...data }),
  });
}

export async function updatePersona(id: string, data: Partial<Persona>): Promise<void> {
  await request(`/api/personas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePersona(id: string): Promise<void> {
  await request(`/api/personas/${id}`, { method: 'DELETE' });
}

// ── User Profile ──
export async function fetchUserProfile(): Promise<UserProfile> {
  return request('/api/user-profile');
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<void> {
  await request('/api/user-profile', { method: 'PUT', body: JSON.stringify(data) });
}

// ── Conversations ──
export async function fetchConversations(): Promise<any[]> {
  return request('/api/conversations');
}

export async function fetchConversation(id: string): Promise<{ id: string; title: string; summary?: string; messages: Message[]; createdAt: number; updatedAt: number }> {
  return request(`/api/conversations/${id}`);
}

export async function createConversation(data: { title?: string }): Promise<{ id: string }> {
  return request('/api/conversations', { method: 'POST', body: JSON.stringify({ id: generateId(), ...data }) });
}

export async function updateConversation(id: string, data: { title?: string; summary?: string; messages?: Message[] }): Promise<void> {
  await request(`/api/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/api/conversations/${id}`, { method: 'DELETE' });
}

// ── API Configs ──
export async function fetchConfigs(): Promise<ApiConfig[]> {
  return request('/api/configs');
}

export async function createConfig(data: Partial<ApiConfig>): Promise<{ id: string }> {
  return request('/api/configs', { method: 'POST', body: JSON.stringify({ id: generateId(), ...data }) });
}

export async function updateConfig(id: string, data: Partial<ApiConfig>): Promise<void> {
  await request(`/api/configs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteConfig(id: string): Promise<void> {
  await request(`/api/configs/${id}`, { method: 'DELETE' });
}

// ── Preferences ──
export async function fetchPreferences(): Promise<any> {
  return request('/api/preferences');
}

export async function updatePreferences(data: any): Promise<void> {
  await request('/api/preferences', { method: 'PUT', body: JSON.stringify(data) });
}

// ── Active State ──
export async function fetchActiveState(): Promise<{ conversationId: string | null }> {
  const data = await request('/api/active-state');
  return { conversationId: data.conversationId ?? null };
}

export async function setActiveConversation(conversationId: string | null): Promise<void> {
  await request('/api/active-state', { method: 'PUT', body: JSON.stringify({ conversationId }) });
}
