import { useState, useMemo, useRef, useEffect } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { usePersonas } from '@/lib/hooks'
import { ConversationListSkeleton } from './Skeletons'
import type { Conversation } from '@/types'

interface Props {
  conversations: Conversation[]
  activeConversationId: string | null
  conversationsLoading?: boolean
  onSelectConversation: (id: string) => void
  onCreateConversation: (title?: string) => Promise<string>
  onDeleteConversation: (id: string) => Promise<void>
  onRenameConversation: (id: string, title: string) => Promise<void>
  onClose: () => void
  className?: string
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationOverlay({ conversations, activeConversationId, conversationsLoading, onSelectConversation, onCreateConversation, onDeleteConversation, onRenameConversation, onClose, className }: Props) {
  const { activePersonaId } = useUIStore()
  const { personas } = usePersonas()
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations
    const q = query.toLowerCase()
    return conversations.filter(c => c.title.toLowerCase().includes(q))
  }, [conversations, query])

  const activePersona = personas.find(p => p.id === activePersonaId)

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const submitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await onRenameConversation(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <div className={`glass-overlay fixed inset-0 z-50 flex flex-col animate-slide-in-left ${className ?? ''}`}>
      <div className="flex items-center justify-between p-5 pb-3">
        <h1 className="text-lg font-medium text-text-primary">Conversations</h1>
        <div className="flex items-center gap-2">
          {activePersona && (
            <span className="text-xs text-accent-primary/70">{activePersona.name}</span>
          )}
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-hover text-text-secondary transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 pb-3">
        <button
          onClick={async () => { await onCreateConversation(); onClose() }}
          className="w-full flex items-center gap-2 px-4 py-3 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl font-medium transition-all mb-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-tertiary/50 border border-surface-tertiary rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/30 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-5">
        <div className="space-y-0.5">
          {conversationsLoading ? (
            <ConversationListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              {query ? 'No matches' : 'No conversations'}
            </div>
          ) : (
            filtered.map(conv => (
              <div key={conv.id} className="group flex items-center gap-1 px-3 py-3 rounded-xl transition-all hover:bg-surface-hover">
                {renamingId === conv.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                    onBlur={submitRename}
                    className="flex-1 px-2 py-1 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <button
                    onClick={() => { onSelectConversation(conv.id); onClose() }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`truncate text-sm ${conv.id === activeConversationId ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                      {conv.title}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{formatDate(conv.updatedAt)}</div>
                  </button>
                )}
                {renamingId !== conv.id && (
                  <>
                    <button onClick={() => startRename(conv)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => { if (confirm('Delete?')) onDeleteConversation(conv.id) }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
