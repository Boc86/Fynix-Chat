import { create } from 'zustand';
import type { Message, Theme, FontSize, ApiConfig } from '@/types';

interface ChatState {
  currentConversationId: string | null;
  currentConversationTitle: string;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  abortController: AbortController | null;
  editingMessageId: string | null;

  setCurrentConversation: (id: string | null) => void;
  setCurrentConversationTitle: (title: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setIsLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  setAbortController: (controller: AbortController | null) => void;
  abortStream: () => void;
  setEditingMessage: (id: string | null) => void;
  clearEditingMessage: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentConversationId: null,
  currentConversationTitle: '',
  messages: [],
  isLoading: false,
  streamingContent: '',
  abortController: null,
  editingMessageId: null,

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  setCurrentConversationTitle: (title) => set({ currentConversationTitle: title }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    const lastIndex = messages.length - 1;
    if (lastIndex >= 0 && messages[lastIndex]?.role === 'assistant') {
      messages[lastIndex] = { ...messages[lastIndex], content };
    }
    return { messages };
  }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setStreamingContent: (content) => set((state) => ({
    streamingContent: state.streamingContent + content
  })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  setAbortController: (controller) => set({ abortController: controller }),

  abortStream: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isLoading: false });
    }
  },

  setEditingMessage: (id) => set({ editingMessageId: id }),

  clearEditingMessage: () => set({ editingMessageId: null })
}));

interface UIState {
  theme: Theme;
  fontSize: FontSize;
  sidebarOpen: boolean;
  activePanel: 'none' | 'settings' | 'persona' | 'history' | 'user-profile' | 'library';
  fontSizeValue: number;
  activePersonaId: string;

  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setSidebarOpen: (open: boolean) => void;
  setActivePanel: (panel: 'none' | 'settings' | 'persona' | 'history' | 'user-profile' | 'library') => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setActivePersonaId: (id: string) => void;
}

const fontSizeMap: Record<FontSize, number> = {
  small: 14,
  medium: 16,
  large: 18
};

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  fontSize: 'medium',
  sidebarOpen: false,
  activePanel: 'none',
  fontSizeValue: 16,
  activePersonaId: 'default',

  setTheme: (theme) => set({ theme }),

  setFontSize: (fontSize) => set({
    fontSize,
    fontSizeValue: fontSizeMap[fontSize]
  }),

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  setActivePanel: (activePanel) => set({ activePanel }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  closeSidebar: () => set({ sidebarOpen: false, activePanel: 'none' }),

  setActivePersonaId: (activePersonaId) => set({ activePersonaId })
}));

interface ConfigState {
  apiConfig: ApiConfig | null;

  setApiConfig: (config: ApiConfig | null) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  apiConfig: null,

  setApiConfig: (apiConfig) => set({ apiConfig })
}));
