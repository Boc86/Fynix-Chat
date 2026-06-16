import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useChatStore, useUIStore, useConfigStore } from '@/stores/chat-store'
import { usePreferences, usePersonas, useApiConfigs, useUserProfile } from '@/lib/hooks'
import { createNIMClient } from '@/lib/providers/nvidia-nim'
import { buildUserProfileText } from '@/lib/providers/context-truncation'
import { generateId } from '@/lib/storage'
import { updateConversation } from '@/lib/api'
import type { Message, Attachment } from '@/types'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatView({ onCreateConversation, onRenameConversation }: { onCreateConversation?: (title?: string) => Promise<string>; onRenameConversation?: (id: string, title: string) => Promise<void> }) {
  const {
    messages,
    isLoading,
    setIsLoading,
    streamingContent,
    setStreamingContent,
    clearStreamingContent,
    setAbortController,
    currentConversationId,
    currentConversationTitle,
    editingMessageId,
    setEditingMessage,
    clearEditingMessage,
    setMessages,
    setCurrentConversation
  } = useChatStore()
  const { toggleSidebar, activePersonaId } = useUIStore()
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

  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachedFiles(prev => [...prev, ...files].slice(10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleEditMessage = (msg: Message) => {
    setInput(msg.content)
    setEditingMessage(msg.id)
    textareaRef.current?.focus()
  }

  const cancelEdit = () => {
    setInput('')
    clearEditingMessage()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!input.trim() && attachedFiles.length === 0) return
    if (isLoading) return
    if (!apiConfig) {
      alert('Please configure your API settings first')
      return
    }

    const persona = activePersona || personas[0]
    if (!persona) {
      alert('No persona configured')
      return
    }

    const userContent = input.trim()
    const fileAttachments: Attachment[] = attachedFiles.map(file => ({
      id: generateId(),
      type: file.type.startsWith('image/') ? 'image' : 'file',
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size
    }))

    const userMessage: Message = {
      id: editingMessageId ?? generateId(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
      attachments: fileAttachments.length > 0 ? fileAttachments : undefined
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
      convId = await onCreateConversation()
      setCurrentConversation(convId)
      if (onRenameConversation) {
        const title = userContent.slice(0, 80) || 'New Chat'
        await updateConversation(convId, { title, messages: updatedMessages })
        useChatStore.getState().setCurrentConversationTitle(title)
        await onRenameConversation(convId, title)
      }
    }

    setInput('')
    setAttachedFiles([])
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

    const abortController = new AbortController()
    setAbortController(abortController)

    const client = createNIMClient(apiConfig.apiKey, apiConfig.baseUrl, apiConfig.model)

    const submitMessages = updatedMessages.slice(0, -1)

    const userProfileText = profile ? buildUserProfileText(profile) : ''

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
            setStreamingContent(chunk)
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
            const msgs = useChatStore.getState().messages
            const lastIndex = msgs.length - 1
            if (lastIndex >= 0 && msgs[lastIndex]?.role === 'assistant') {
              const updated = [...msgs]
              const msg = updated[lastIndex]
              if (msg) {
                updated[lastIndex] = { ...msg, content: `Error: ${err.message}` }
                useChatStore.getState().setMessages(updated)
              }
            }
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
            const msgs = useChatStore.getState().messages
            const lastIndex = msgs.length - 1
            if (lastIndex >= 0 && msgs[lastIndex]?.role === 'assistant') {
              const updated = [...msgs]
              const msg = updated[lastIndex]
              if (msg) {
                updated[lastIndex] = { ...msg, content: `Error: ${err.message}` }
                useChatStore.getState().setMessages(updated)
              }
            }
          }
        })
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
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
      clearStreamingContent()

      if (isNewConversation) {
        if (convId) {
          const finalMessages = useChatStore.getState().messages
          await updateConversation(convId, { messages: finalMessages })
        }
      } else if (convId) {
        const finalMessages = useChatStore.getState().messages
        await updateConversation(convId, { messages: finalMessages })
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="flex items-center gap-3 p-3 border-b border-surface-tertiary bg-surface-primary">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary md:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-text-primary truncate">
            {currentConversationTitle || 'New Chat'}
          </h2>
          {activePersona && (
            <p className="text-xs text-text-muted truncate">{activePersona.name}</p>
          )}
        </div>

        {isLoading && (
          <button
            onClick={() => useChatStore.getState().abortStream()}
            className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
          >
            Stop
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium mb-1">Start a conversation</p>
            <p className="text-sm">Ask a question or share something to begin</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onEdit={message.role === 'user' ? handleEditMessage : undefined}
          />
        ))}

        {isLoading && streamingContent === '' && messages[messages.length - 1]?.role === 'assistant' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-white text-sm font-medium">
              AI
            </div>
            <div className="flex-1">
              <div className="animate-pulse-subtle flex gap-1">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-surface-tertiary">
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachedFiles.map((file, index) => (
              <div key={index} className="relative group">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary rounded-lg border border-surface-tertiary max-w-48">
                    <svg className="w-5 h-5 shrink-0 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">{file.name}</div>
                      <div className="text-xs text-text-muted">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeAttachedFile(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileAttach}
            accept="*/*"
            multiple
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg bg-surface-secondary hover:bg-surface-hover text-text-secondary transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {editingMessageId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-3 py-3 rounded-lg bg-surface-secondary hover:bg-surface-hover text-text-secondary text-sm transition-colors"
            >
              Cancel
            </button>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={editingMessageId ? 'Edit your message...' : 'Type your message...'}
              className="w-full px-4 py-3 bg-surface-secondary border-none rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary"
              rows={1}
              style={{ fontSize: `${useUIStore.getState().fontSizeValue}px` }}
            />
          </div>

          <button
            type="submit"
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            className="px-5 py-3 bg-accent-primary hover:bg-accent-secondary disabled:bg-surface-tertiary disabled:text-text-muted text-white rounded-xl font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

function FileAttachmentCard({ attachment }: { attachment: Attachment }) {
  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="flex items-center gap-2 px-3 py-2 bg-surface-primary/10 rounded-lg border border-surface-tertiary/30 hover:bg-surface-primary/20 transition-colors no-underline text-inherit max-w-64"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <div className="min-w-0">
        <div className="text-sm truncate">{attachment.name}</div>
        <div className="text-xs opacity-70">{formatFileSize(attachment.size)}</div>
      </div>
    </a>
  )
}

function MessageBubble({ message, onEdit }: { message: Message; onEdit?: (msg: Message) => void }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
        isUser ? 'bg-accent-primary text-white' : 'bg-surface-tertiary text-text-primary'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>

      <div className={`flex-1 max-w-2xl ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left px-4 py-3 rounded-2xl relative ${
          isUser ? 'bg-accent-primary text-white' : 'bg-surface-secondary text-text-primary'
        }`}>
          {isUser && onEdit && (
            <button
              onClick={() => onEdit(message)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-surface-secondary border border-surface-tertiary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-hover"
              title="Edit message"
            >
              <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {message.attachments?.map(att => (
            att.type === 'image' ? (
              <img key={att.id} src={att.url} alt={att.name} className="max-w-xs rounded-lg mb-2" />
            ) : (
              <div key={att.id} className="mb-2">
                <FileAttachmentCard attachment={att} />
              </div>
            )
          ))}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !className
                    return isInline ? (
                      <code className={className}>{children}</code>
                    ) : (
                      <SyntaxHighlighter
                        customStyle={{ background: 'var(--color-surface-tertiary)', margin: '1em 0', borderRadius: '8px' }}
                        language={match ? match[1] : 'text'}
                        PreTag="div"
                        className="rounded-lg !bg-surface-tertiary/50 !my-2"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="text-xs text-text-muted mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
