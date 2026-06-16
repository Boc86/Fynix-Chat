import { useState, useMemo, useRef, useEffect } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { usePersonas } from '@/lib/hooks'
import { ConversationListSkeleton } from './Skeletons'
import { useToastStore } from '@/stores/toast-store'
import type { Conversation } from '@/types'

interface SidebarProps {
  open: boolean
  onClose: () => void
  conversations: Conversation[]
  activeConversationId: string | null
  conversationsLoading?: boolean
  onSelectConversation: (id: string) => void
  onCreateConversation: (title?: string) => Promise<string>
  onDeleteConversation: (id: string) => Promise<void>
  onRenameConversation: (id: string, title: string) => Promise<void>
}

export function Sidebar({ open, onClose, conversations, activeConversationId, conversationsLoading, onSelectConversation, onCreateConversation, onDeleteConversation, onRenameConversation }: SidebarProps) {
  const { activeToolTab, setActiveToolTab, activePersonaId } = useUIStore()
  const { personas } = usePersonas()
  const addToast = useToastStore(s => s.addToast)
  const [searchQuery, setSearchQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.messages?.some(m => m.content.toLowerCase().includes(query))
    )
  }, [conversations, searchQuery])

  const activePersona = personas.find(p => p.id === activePersonaId)

  const handleNewChat = async () => {
    try {
      await onCreateConversation()
      onClose()
    } catch (err) {
      console.error('Failed to create conversation', err)
      addToast('Failed to create conversation', 'error')
    }
  }

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const submitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await onRenameConversation(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity md:hidden ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-72 glass-panel-strong border-r border-surface-tertiary/50
        flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-surface-tertiary">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-text-primary">Fynix Chat</h1>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary md:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-secondary hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_14px_var(--color-accent-primary)] text-white rounded-lg font-medium transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {conversationsLoading ? (
              <ConversationListSkeleton />
            ) : filteredConversations.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-1 px-3 py-2.5 rounded-lg transition-all ${
                    conv.id === activeConversationId
                      ? 'glow-border-left bg-surface-hover text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                  onDoubleClick={() => startRename(conv)}
                >
                  {renamingId === conv.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename()
                        if (e.key === 'Escape') cancelRename()
                      }}
                      onBlur={submitRename}
                      className="flex-1 min-w-0 px-1 py-0 bg-surface-tertiary border-none rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onClick={() => onSelectConversation(conv.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="truncate font-medium text-sm">{conv.title}</div>
                      <div className="text-xs text-text-muted mt-0.5">{formatDate(conv.updatedAt)}</div>
                    </button>
                  )}
                  {renamingId !== conv.id && (
                    <>
                      <button
                        onClick={() => startRename(conv)}
                        className="p-1.5 rounded-md text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this conversation?')) {
                            onDeleteConversation(conv.id)
                          }
                        }}
                        className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Delete conversation"
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

        <div className="p-3 border-t border-surface-tertiary space-y-1">
          <button
            onClick={() => { setActiveToolTab('library'); onClose() }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeToolTab === 'library' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            File Library
          </button>

          <button
            onClick={() => { setActiveToolTab('user-profile'); onClose() }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeToolTab === 'user-profile' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            User Profile
          </button>

          <button
            onClick={() => { setActiveToolTab('persona'); onClose() }}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeToolTab === 'persona' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Bot Persona
            </div>
            {activePersona && (
              <span className="text-xs text-accent-primary truncate max-w-24">{activePersona.name}</span>
            )}
          </button>

          <button
            onClick={() => { setActiveToolTab('settings'); onClose() }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeToolTab === 'settings' ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </aside>
    </>
  )
}
