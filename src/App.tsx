import { useEffect, useCallback, useState, useRef } from 'react'
import { useUIStore, useChatStore } from './stores/chat-store'
import { useConversations, usePreferences } from './lib/hooks'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { SettingsPanel } from './components/SettingsPanel'
import { PersonaPanel } from './components/PersonaPanel'
import { UserProfilePanel } from './components/UserProfilePanel'
import { LibraryPanel } from './components/LibraryPanel'
import { ToastContainer } from './components/ToastContainer'
import type { Theme } from './types'

export function App() {
  const { theme, setTheme, sidebarOpen, activePanel, closeSidebar, setActivePanel } = useUIStore()
  const { setMessages, setCurrentConversation, setCurrentConversationTitle } = useChatStore()
  const { conversations, activeConversationId, setActiveConversation, createConversation, deleteConversation, updateConversation, loading: conversationsLoading } = useConversations()
  const { preferences } = usePreferences()

  const [closingPanel, setClosingPanel] = useState<string | null>(null)
  const prevPanelRef = useRef(activePanel)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (prevPanelRef.current !== 'none' && activePanel === 'none') {
      setClosingPanel(prevPanelRef.current)
      closeTimerRef.current = setTimeout(() => {
        setClosingPanel(null)
      }, 300)
    } else if (activePanel !== 'none') {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = undefined
      }
      setClosingPanel(null)
    }
    prevPanelRef.current = activePanel

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [activePanel])

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
      if (e.key === 'Escape' && sidebarOpen) {
        closeSidebar()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen, closeSidebar])

  const handleSelectConversation = useCallback(async (id: string) => {
    await setActiveConversation(id)
    closeSidebar()
  }, [setActiveConversation, closeSidebar])

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

  const currentPanel = activePanel !== 'none' ? activePanel : closingPanel
  const panelClosing = closingPanel !== null && activePanel === 'none'

  const renderPanelFor = (panel: string | null) => {
    switch (panel) {
      case 'settings': return <SettingsPanel />
      case 'persona': return <PersonaPanel />
      case 'user-profile': return <UserProfilePanel />
      case 'library': return <LibraryPanel />
      default: return null
    }
  }

  return (
    <div className="h-full flex bg-surface-primary animate-fade-in">
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        conversations={conversations}
        activeConversationId={activeConversationId}
        conversationsLoading={conversationsLoading}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <ChatView
          onCreateConversation={handleCreateConversation}
          onRenameConversation={handleRenameConversation}
        />
      </main>

      {currentPanel && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${panelClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => setActivePanel('none')}
          />
          <div className={`fixed right-0 top-0 h-full w-full max-w-md glass-panel-strong z-50 overflow-y-auto ${
            panelClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
          }`}>
            {renderPanelFor(currentPanel)}
          </div>
        </>
      )}

      <ToastContainer />
    </div>
  )
}
