import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore, useUIStore, useConfigStore } from '@/stores/chat-store'
import { usePreferences, usePersonas, useApiConfigs, useUserProfile } from '@/lib/hooks'
import { createNIMClient } from '@/lib/providers/nvidia-nim'
import { buildUserProfileText } from '@/lib/providers/context-truncation'
import { generateId } from '@/lib/storage'
import { updateConversation, fetchConversation, searchWeb } from '@/lib/api'
import { useToastStore } from '@/stores/toast-store'
import { InputPill } from './InputPill'
import { MessageBlock } from './MessageBlock'
import type { Message } from '@/types'

export function ChatView({ onCreateConversation, onRenameConversation }: { onCreateConversation?: (title?: string) => Promise<string>; onRenameConversation?: (id: string, title: string) => Promise<void> }) {
  const {
    messages,
    isLoading,
    setIsLoading,
    streamingContent,
    clearStreamingContent,
    setAbortController,
    currentConversationId,
    editingMessageId,
    setEditingMessage,
    clearEditingMessage,
    setMessages,
    setCurrentConversation,
    setCurrentConversationTitle
  } = useChatStore()
  const { activePersonaId } = useUIStore()
  const { preferences } = usePreferences()
  const { personas, getPersonaById } = usePersonas()
  const { profile } = useUserProfile()
  const { apiConfig, setApiConfig } = useConfigStore()
  const { configs } = useApiConfigs()

  const activePersona = getPersonaById(activePersonaId)

  useEffect(() => {
    if (!apiConfig && configs.length > 0) {
      const cfg = configs.find(c => c.isDefault) || configs[0]
      if (cfg) setApiConfig(cfg)
    }
  }, [apiConfig, configs, setApiConfig])

  const [searchEnabled, setSearchEnabled] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const addToast = useToastStore(s => s.addToast)
  const creatingConvIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (currentConversationId && currentConversationId !== creatingConvIdRef.current) {
      fetchConversation(currentConversationId).then(conv => {
        if (conv) {
          setMessages(conv.messages)
          setCurrentConversationTitle(conv.title)
        }
      })
    }
  }, [currentConversationId, setMessages, setCurrentConversationTitle])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg.id)
  }

  const setErrorOnLastMessage = (errMsg: string) => {
    const msgs = useChatStore.getState().messages
    const lastIndex = msgs.length - 1
    if (lastIndex >= 0 && msgs[lastIndex]?.role === 'assistant') {
      const updated = [...msgs]
      const m = updated[lastIndex]
      if (m) {
        updated[lastIndex] = { ...m, content: `Error: ${errMsg}` }
        useChatStore.getState().setMessages(updated)
      }
    }
  }

  const handleSend = useCallback(async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return
    if (isLoading) return
    if (!apiConfig) {
      addToast('Please configure your API settings first', 'error')
      return
    }

    const persona = activePersona || personas[0]
    if (!persona) {
      addToast('No persona configured', 'error')
      return
    }

    const fileAttachments = files.length > 0 ? files.map(file => ({
      id: generateId(),
      type: (file.type.startsWith('image/') ? 'image' : 'file') as 'image' | 'file',
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size
    })) : undefined

    const userMessage: Message = {
      id: editingMessageId ?? generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      attachments: fileAttachments
    }

    let updatedMessages: Message[]

    if (editingMessageId) {
      const editIndex = messages.findIndex(m => m.id === editingMessageId)
      if (editIndex !== -1) {
        updatedMessages = [...messages.slice(0, editIndex), userMessage]
      } else {
        updatedMessages = [...messages, userMessage]
      }
      clearEditingMessage()
    } else {
      updatedMessages = [...messages, userMessage]
    }

    const isNewConversation = !currentConversationId
    let convId = currentConversationId
    if (isNewConversation && onCreateConversation) {
      setMessages(updatedMessages)
      setIsLoading(true)
      convId = await onCreateConversation()
      creatingConvIdRef.current = convId
      setCurrentConversation(convId)
      if (onRenameConversation) {
        const title = text.trim().slice(0, 80) || 'New Chat'
        await updateConversation(convId, { title, messages: updatedMessages })
        useChatStore.getState().setCurrentConversationTitle(title)
        await onRenameConversation(convId, title)
      }
    }

    clearStreamingContent()
    setIsLoading(true)

    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    updatedMessages = [...updatedMessages, assistantMessage]
    setMessages(updatedMessages)

    let assistantContent = ''

    const abortController = new AbortController()
    setAbortController(abortController)

    const client = createNIMClient(apiConfig.apiKey, apiConfig.baseUrl, apiConfig.model)

    const submitMessages = updatedMessages.slice(0, -1)

    let userProfileText = profile ? buildUserProfileText(profile) : ''

    if (searchEnabled) {
      try {
        const searchRes = await searchWeb(text.trim())
        if (searchRes.results && searchRes.results.length > 0) {
          const formatted = searchRes.results.map((r, i) =>
            `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`
          ).join('\n\n')
          userProfileText += `\n\n---\n\n## LIVE WEB SEARCH RESULTS\n\nYou MUST use these results to answer. They were fetched in real-time from the internet for the query "${text.trim()}". Do NOT say you cannot access live information — these ARE live results.\n\n${formatted}`
        }
      } catch (err) {
        console.error('Web search failed:', err)
        addToast('Web search failed, continuing without results', 'info')
      }
    }

    try {
      if (preferences.streaming) {
        await client.chat(submitMessages, {
          systemPrompt: persona.systemPrompt,
          userProfileText,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          stream: true,
          abortSignal: abortController.signal,
          onChunk: (chunk) => {
            assistantContent += chunk
            const msgs = useChatStore.getState().messages
            const lastIndex = msgs.length - 1
            if (lastIndex >= 0 && msgs[lastIndex]?.role === 'assistant') {
              const updated = [...msgs]
              const msg = updated[lastIndex]
              if (msg) {
                updated[lastIndex] = { ...msg, content: msg.content + chunk }
                useChatStore.getState().setMessages(updated)
              }
            }
          },
          onError: (err) => {
            console.error('Chat error:', err)
            setErrorOnLastMessage(err.message)
          }
        })
      } else {
        const response = await client.chat(submitMessages, {
          systemPrompt: persona.systemPrompt,
          userProfileText,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          stream: false,
          abortSignal: abortController.signal,
          onError: (err) => {
            console.error('Chat error:', err)
            setErrorOnLastMessage(err.message)
          }
        })
        assistantContent = response
        const msgs = useChatStore.getState().messages
        const lastIndex = msgs.length - 1
        if (lastIndex >= 0 && msgs[lastIndex]?.role === 'assistant') {
          const updated = [...msgs]
          const msg = updated[lastIndex]
          if (msg) {
            updated[lastIndex] = { ...msg, content: response }
            useChatStore.getState().setMessages(updated)
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Chat error:', err)
        addToast(err.message, 'error')
      }
    } finally {
      creatingConvIdRef.current = null
      setIsLoading(false)
      setAbortController(null)
      clearStreamingContent()

      if (convId) {
        const finalMessages: Message[] = [
          ...updatedMessages.slice(0, -1),
          { ...assistantMessage, content: assistantContent }
        ]
        try {
          await updateConversation(convId, { messages: finalMessages })
        } catch {
          addToast('Failed to save messages', 'error')
        }
      }
    }
  }, [isLoading, apiConfig, activePersona, personas, messages, editingMessageId, clearEditingMessage, currentConversationId, onCreateConversation, setIsLoading, setMessages, setCurrentConversation, onRenameConversation, profile, preferences, setAbortController, clearStreamingContent, addToast, searchEnabled])

  const editingContent = editingMessageId
    ? messages.find(m => m.id === editingMessageId)?.content
    : undefined

  const handleCancelEdit = () => {
    clearEditingMessage()
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-0 py-24 pb-36 relative">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-text-muted px-6">
            <div className="relative w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-full bg-accent-primary/10 animate-float" />
              <div className="absolute inset-3 rounded-full bg-accent-primary/20 animate-float" style={{ animationDelay: '0.5s' }} />
              <div className="absolute inset-6 rounded-full bg-accent-primary/30 animate-float" style={{ animationDelay: '1s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <p className="text-base font-medium mb-1 text-text-primary">Start a conversation</p>
            <p className="text-sm text-text-muted/70">Type below or swipe left for history</p>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((message, idx) => {
            const prevRole = idx > 0 ? messages[idx - 1]?.role : null
            return (
              <MessageBlock
                key={message.id}
                message={message}
                isFirst={prevRole !== message.role}
                onEdit={message.role === 'user' ? handleEditMessage : undefined}
              />
            )
          })}

          {isLoading && streamingContent === '' && (
            <div className="px-4 md:px-8">
              <div className="role-dot" />
              <div className="flex items-center gap-1.5 pl-1">
                <span className="w-2 h-2 rounded-full bg-accent-primary/60 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-accent-primary/40 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 rounded-full bg-accent-primary/20 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {isLoading && (
        <button
          onClick={() => useChatStore.getState().abortStream()}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-surface-secondary/80 backdrop-blur-md border border-surface-tertiary rounded-xl text-sm text-text-secondary hover:text-red-500 hover:border-red-500/30 transition-all"
        >
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop generating
          </span>
        </button>
      )}

      <InputPill
        onSend={handleSend}
        disabled={isLoading}
        editingContent={editingContent}
        onCancelEdit={editingMessageId ? handleCancelEdit : undefined}
        searchEnabled={searchEnabled}
        onToggleSearch={() => setSearchEnabled(s => !s)}
      />
    </div>
  )
}
