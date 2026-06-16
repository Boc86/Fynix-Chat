import { useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import type { Message, Attachment } from '@/types'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileLink({ attachment }: { attachment: Attachment }) {
  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-surface-tertiary/50 hover:bg-surface-hover transition-all text-sm no-underline text-text-secondary hover:text-text-primary my-1"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span className="truncate max-w-24">{attachment.name}</span>
      <span className="text-text-muted text-xs">{formatFileSize(attachment.size)}</span>
    </a>
  )
}

interface MessageBlockProps {
  message: Message
  isFirst: boolean
  onEdit?: (msg: Message) => void
  style?: React.CSSProperties
  isStreaming?: boolean
}

export function MessageBlock({ message, isFirst, onEdit, style, isStreaming }: MessageBlockProps) {
  const isUser = message.role === 'user'
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>()

  const handleTouchStart = useCallback(() => {
    if (!isUser) return
    longPressTimer.current = setTimeout(() => {
      onEdit?.(message)
    }, 600)
  }, [isUser, message, onEdit])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }, [])

  return (
    <div
      className={`group relative px-4 md:px-8 ${isUser ? 'text-right' : ''} animate-fade-in-up`}
      style={style}
      onTouchStart={isUser ? handleTouchStart : undefined}
      onTouchEnd={isUser ? handleTouchEnd : undefined}
      onTouchMove={isUser ? handleTouchEnd : undefined}
    >
      {isFirst && <div className="role-dot" />}

      <div className={`relative ${isUser ? 'glow-text-user' : 'glow-text-ai'} inline-block max-w-2xl text-left ${isUser ? 'ml-auto' : ''}`}>
        {isUser && onEdit && (
          <button
            onClick={() => onEdit(message)}
            className="absolute -left-8 top-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 md:flex hidden"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        <div className={`${isUser ? 'font-medium' : 'font-light'} text-sm md:text-base leading-relaxed`}>
          {message.attachments?.map(att => (
            att.type === 'image' ? (
              <img key={att.id} src={att.url} alt={att.name} className="max-w-xs rounded-lg mb-2" />
            ) : (
              <FileLink key={att.id} attachment={att} />
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
                    const inline = !match && !className
                    if (inline) return <code className={className}>{children}</code>
                    return (
                      <SyntaxHighlighter
                        customStyle={{
                          background: 'transparent',
                          margin: '0.5em 0',
                          padding: '0.5em 0',
                          fontSize: '0.85em',
                        }}
                        language={match ? match[1] : 'text'}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>

        <div className="text-[10px] text-text-muted/50 mt-1 select-none">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
