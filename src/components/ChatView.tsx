import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useChatStore, useUIStore, useConfigStore } from '@/stores/chat-store'
import { useConversations, usePreferences, usePersona } from '@/lib/hooks'
import { createNIMClient } from '@/lib/providers/nvidia-nim'
import type { Message } from '@/types'

export function ChatView() {
  const {
    messages,
    addMessage,
    updateLastMessage,
    isLoading,
    setIsLoading,
    streamingContent,
    setStreamingContent,
    clearStreamingContent,
    setAbortController,
    currentConversationId
  } = useChatStore()
  const { toggleSidebar } = useUIStore()
  const { preferences } = usePreferences()
  const { persona } = usePersona()
  const { apiConfig } = useConfigStore()
  const { updateConversation } = useConversations()

  const [input, setInput] = useState('')
  const [attachedImages, setAttachedImages] = useState<File[]>([])
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

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    setAttachedImages(prev => [...prev, ...imageFiles].slice(5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!input.trim() && attachedImages.length === 0) return
    if (isLoading) return
    if (!apiConfig) {
      alert('Please configure your API settings first')
      return
    }

    const userContent = input.trim()
    const imageAttachments = attachedImages.map(file => ({
      id: crypto.randomUUID(),
      type: 'image' as const,
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size
    }))

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
      attachments: imageAttachments.length > 0 ? imageAttachments : undefined
    }

    addMessage(userMessage)
    setInput('')
    setAttachedImages([])
    clearStreamingContent()
    setIsLoading(true)

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }
    addMessage(assistantMessage)

    const abortController = new AbortController()
    setAbortController(abortController)

    const client = createNIMClient(apiConfig.apiKey, apiConfig.baseUrl, apiConfig.model)

    try {
      if (preferences.streaming) {
        await client.chat([...messages, userMessage], {
          systemPrompt: persona.systemPrompt,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          stream: true,
          abortSignal: abortController.signal,
          onChunk: (chunk) => {
            setStreamingContent(chunk)
            updateLastMessage(streamingContent + chunk)
          },
          onError: (err) => {
            console.error('Chat error:', err)
            updateLastMessage(`Error: ${err.message}`)
          }
        })
      } else {
        const response = await client.chat([...messages, userMessage], {
          systemPrompt: persona.systemPrompt,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          stream: false,
          abortSignal: abortController.signal,
          onError: (err) => {
            console.error('Chat error:', err)
            updateLastMessage(`Error: ${err.message}`)
          }
        })
        updateLastMessage(response)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Chat error:', err)
        updateLastMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)

      if (currentConversationId) {
        const updatedMessages = [...messages, userMessage, { ...assistantMessage, content: streamingContent || messages[messages.length - 1]?.content }]
        await updateConversation(currentConversationId, { messages: JSON.stringify(updatedMessages) })
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

        <div className="flex-1">
          <h2 className="font-medium text-text-primary truncate">
            {messages.length === 0 ? 'New Chat' : messages[0]?.content.slice(0, 50) || 'Chat'}
          </h2>
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
          <MessageBubble key={message.id} message={message} />
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
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachedImages.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageAttach}
            accept="image/*"
            multiple
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg bg-surface-secondary hover:bg-surface-hover text-text-secondary transition-colors"
            title="Attach image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="w-full px-4 py-3 bg-surface-secondary border-none rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary"
              rows={1}
              style={{ fontSize: `${useUIStore.getState().fontSizeValue}px` }}
            />
          </div>

          <button
            type="submit"
            disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
        isUser ? 'bg-accent-primary text-white' : 'bg-surface-tertiary text-text-primary'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>

      <div className={`flex-1 max-w-2xl ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left px-4 py-3 rounded-2xl ${
          isUser ? 'bg-accent-primary text-white' : 'bg-surface-secondary text-text-primary'
        }`}>
          {message.attachments?.map(att => (
            <img key={att.id} src={att.url} alt={att.name} className="max-w-xs rounded-lg mb-2" />
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