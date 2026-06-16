import { useEffect, useCallback, useState, useRef } from 'react'
import { useUIStore, useChatStore } from './stores/chat-store'
import { useConversations, usePreferences } from './lib/hooks'
import { ChatView } from './components/ChatView'
import { ConversationOverlay } from './components/ConversationOverlay'
import { ToolsOverlay } from './components/ToolsOverlay'
import { ToastContainer } from './components/ToastContainer'
import type { Theme } from './types'

export function App() {
  const { theme, setTheme, activeOverlay, closeOverlay } = useUIStore()
  const { setMessages, setCurrentConversation, setCurrentConversationTitle } = useChatStore()
  const { conversations, activeConversationId, setActiveConversation, createConversation, deleteConversation, updateConversation, loading: conversationsLoading } = useConversations()
  const { preferences } = usePreferences()

  const [closingOverlay, setClosingOverlay] = useState<string | null>(null)
  const prevOverlayRef = useRef(activeOverlay)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (prevOverlayRef.current !== 'none' && activeOverlay === 'none') {
      setClosingOverlay(prevOverlayRef.current)
      closeTimerRef.current = setTimeout(() => {
        setClosingOverlay(null)
      }, 300)
    } else if (activeOverlay !== 'none') {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = undefined
      }
      setClosingOverlay(null)
    }
    prevOverlayRef.current = activeOverlay

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [activeOverlay])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (!preferences) return
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const effectiveTheme = preferences.theme === 'system' ? systemTheme : preferences.theme
    setTheme(effectiveTheme as Theme)
  }, [preferences?.theme, setTheme])

  useEffect(() => {
    if (activeConversationId) {
      setCurrentConversation(activeConversationId)
      const conv = conversations.find(c => c.id === activeConversationId)
      if (conv) setCurrentConversationTitle(conv.title)
    } else {
      setMessages([])
      setCurrentConversation(null)
      setCurrentConversationTitle('')
    }
  }, [activeConversationId, setMessages, setCurrentConversation, setCurrentConversationTitle, conversations])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOverlay !== 'none') {
        closeOverlay()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [activeOverlay, closeOverlay])

  const handleSelectConversation = useCallback(async (id: string) => {
    await setActiveConversation(id)
  }, [setActiveConversation])

  const handleCreateConversation = useCallback(async (title?: string) => {
    const id = await createConversation(title)
    return id
  }, [createConversation])

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id)
  }, [deleteConversation])

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    await updateConversation(id, { title })
    if (id === useChatStore.getState().currentConversationId) {
      setCurrentConversationTitle(title)
    }
  }, [updateConversation, setCurrentConversationTitle])

  const isConvOpen = activeOverlay === 'conversations' || closingOverlay === 'conversations'
  const convClosing = closingOverlay === 'conversations' && activeOverlay === 'none'
  const isToolsOpen = activeOverlay === 'tools' || closingOverlay === 'tools'
  const toolsClosing = closingOverlay === 'tools' && activeOverlay === 'none'

  return (
    <div className="h-full flex bg-surface-primary animate-fade-in">
      {isConvOpen && (
        <ConversationOverlay
          conversations={conversations}
          activeConversationId={activeConversationId}
          conversationsLoading={conversationsLoading}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={handleCreateConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onClose={closeOverlay}
          className={convClosing ? 'animate-slide-out-left' : ''}
        />
      )}

      {isToolsOpen && (
        <ToolsOverlay
          onClose={closeOverlay}
          className={toolsClosing ? 'animate-slide-out-right' : ''}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <ChatView
          onCreateConversation={handleCreateConversation}
          onRenameConversation={handleRenameConversation}
        />

        {/* Desktop edge tap zones */}
        <div className="hidden md:block">
          <button
            onClick={() => useUIStore.getState().toggleOverlay('conversations')}
            className="fixed left-0 top-0 bottom-24 w-10 z-10 cursor-pointer"
            aria-label="Open conversations"
          />
          <button
            onClick={() => useUIStore.getState().toggleOverlay('tools')}
            className="fixed right-0 top-0 bottom-24 w-10 z-10 cursor-pointer"
            aria-label="Open tools"
          />
        </div>
      </main>

      <ToastContainer />
    </div>
  )
}
