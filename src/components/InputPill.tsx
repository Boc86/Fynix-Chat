import { useState, useRef, useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/chat-store'

interface InputPillProps {
  onSend: (text: string, files: File[]) => Promise<void>
  disabled?: boolean
  editingContent?: string
  onCancelEdit?: () => void
}

export function InputPill({ onSend, disabled, editingContent, onCancelEdit }: InputPillProps) {
  const { toggleOverlay } = useUIStore()
  const [text, setText] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)

  useEffect(() => {
    if (editingContent !== undefined) {
      setText(editingContent)
      textareaRef.current?.focus()
    }
  }, [editingContent])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text, isFocused])

  const hasContent = text.trim().length > 0 || attachedFiles.length > 0
  const idle = !hasContent && !isFocused && !editingContent

  const submit = useCallback(async () => {
    if (!text.trim() && attachedFiles.length === 0) return
    if (disabled) return
    await onSend(text.trim(), attachedFiles)
    setText('')
    setAttachedFiles([])
  }, [text, attachedFiles, disabled, onSend])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
    swiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - touchStartX.current)
    const dy = Math.abs(touch.clientY - touchStartY.current)
    if (dx > 10 || dy > 10) swiping.current = true
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swiping.current) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      toggleOverlay(dx > 0 ? 'conversations' : 'tools')
    }
  }

  const attachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachedFiles(prev => [...prev, ...files].slice(10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={attachFiles} accept="*/*" multiple className="hidden" />

      {attachedFiles.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-2 max-w-sm w-[90vw] px-2 overflow-x-auto pb-1">
          {attachedFiles.map((f, i) => (
            <div key={i} className="relative group shrink-0">
              {f.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-14 h-14 object-cover rounded-xl" />
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-2 glass-overlay rounded-xl text-xs whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate max-w-16">{f.name}</span>
                </div>
              )}
              <button onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              >x</button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-xl transition-all duration-300 ${idle ? 'scale-100' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`input-pill rounded-2xl flex items-end gap-1.5 px-2.5 py-2 ${idle ? 'idle' : ''} ${isFocused || hasContent ? 'shadow-lg shadow-accent-primary/10' : ''}`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-all shrink-0 mb-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message"
            className="flex-1 bg-transparent border-none text-text-primary placeholder:text-text-muted/40 resize-none focus:outline-none text-sm leading-relaxed py-0.5"
            rows={1}
          />

          {editingContent !== undefined && (
            <button
              type="button"
              onClick={() => { setText(''); onCancelEdit?.() }}
              className="p-1.5 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-all shrink-0 mb-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {hasContent && (
            <button
              type="button"
              onClick={submit}
              disabled={disabled}
              className="p-1.5 rounded-xl bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-40 transition-all shrink-0 mb-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
