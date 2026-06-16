import { useEffect, useCallback } from 'react'
import { useUIStore, useChatStore } from './stores/chat-store'
import { useConversations, usePreferences } from './lib/hooks'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { SettingsPanel } from './components/SettingsPanel'
import { PersonaPanel } from './components/PersonaPanel'
import { UserProfilePanel } from './components/UserProfilePanel'
import { LibraryPanel } from './components/LibraryPanel'
import type { Theme } from './types'

export function App() {
  const { theme, setTheme, sidebarOpen, activePanel, closeSidebar } = useUIStore()
  const { setMessages, setCurrentConversation, setCurrentConversationTitle } = useChatStore()
  const { conversations, activeConversationId, setActiveConversation, createConversation, deleteConversation, updateConversation } = useConversations()
  const { preferences } = usePreferences()

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

  const renderPanel = () => {
    switch (activePanel) {
      case 'settings':
        return <SettingsPanel />
      case 'persona':
        return <PersonaPanel />
      case 'user-profile':
        return <UserProfilePanel />
      case 'library':
        return <LibraryPanel />
      default:
        return null
    }
  }

  return (
    <div className="h-full flex bg-surface-primary">
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        conversations={conversations}
        activeConversationId={activeConversationId}
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

      {activePanel !== 'none' && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeSidebar}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface-primary z-50 animate-slide-in overflow-y-auto">
            {renderPanel()}
          </div>
        </>
      )}
    </div>
  )
}
