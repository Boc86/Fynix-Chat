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
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    const lastIndex = messages.length - 1;
    if (lastIndex >= 0 && messages[lastIndex]?.role === 'assistant') {
      messages[lastIndex] = { ...messages[lastIndex], content };
    }
    return { messages };
  }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setStreamingContent: (content) => set((state) => ({ streamingContent: state.streamingContent + content })),
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

type Overlay = 'none' | 'conversations' | 'tools';
type ToolTab = 'settings' | 'persona' | 'user-profile' | 'library';

interface UIState {
  theme: Theme;
  fontSize: FontSize;
  fontSizeValue: number;
  activeOverlay: Overlay;
  activeToolTab: ToolTab;
  activePersonaId: string;

  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setActiveOverlay: (overlay: Overlay) => void;
  setActiveToolTab: (tab: ToolTab) => void;
  closeOverlay: () => void;
  toggleOverlay: (overlay: Overlay) => void;
  setActivePersonaId: (id: string) => void;
  /** @deprecated Use closeOverlay/toggleOverlay instead */
  setActivePanel: (panel: string) => void;
}

const fontSizeMap: Record<FontSize, number> = {
  small: 14,
  medium: 16,
  large: 18
};

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  fontSize: 'medium',
  fontSizeValue: 16,
  activeOverlay: 'none',
  activeToolTab: 'settings',
  activePersonaId: 'default',

  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize, fontSizeValue: fontSizeMap[fontSize] }),
  setActiveOverlay: (activeOverlay) => set({ activeOverlay }),
  setActiveToolTab: (activeToolTab) => set({ activeToolTab }),
  closeOverlay: () => set({ activeOverlay: 'none' }),
  toggleOverlay: (overlay) => set((state) => ({ activeOverlay: state.activeOverlay === overlay ? 'none' : overlay })),
  setActivePersonaId: (activePersonaId) => set({ activePersonaId }),
  setActivePanel: (panel) => {
    if (panel === 'none') return set({ activeOverlay: 'none' });
    const tab = panel as ToolTab;
    set({ activeOverlay: 'tools', activeToolTab: tab });
  },
}));

interface ConfigState {
  apiConfig: ApiConfig | null;
  setApiConfig: (config: ApiConfig | null) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  apiConfig: null,
  setApiConfig: (apiConfig) => set({ apiConfig })
}));
