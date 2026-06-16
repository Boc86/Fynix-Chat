import { useUIStore } from '@/stores/chat-store'
import { SettingsPanel } from './SettingsPanel'
import { PersonaPanel } from './PersonaPanel'
import { UserProfilePanel } from './UserProfilePanel'
import { LibraryPanel } from './LibraryPanel'

const tabs = [
  { id: 'persona' as const, label: 'Persona', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'settings' as const, label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { id: 'user-profile' as const, label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'library' as const, label: 'Library', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
]

interface Props {
  onClose: () => void
  className?: string
}

export function ToolsOverlay({ onClose, className }: Props) {
  const { activeToolTab, setActiveToolTab } = useUIStore()

  const renderPanel = () => {
    switch (activeToolTab) {
      case 'settings': return <SettingsPanel />
      case 'persona': return <PersonaPanel />
      case 'user-profile': return <UserProfilePanel />
      case 'library': return <LibraryPanel />
    }
  }

  return (
    <div className={`glass-overlay fixed inset-0 z-50 flex flex-col animate-slide-in-right ${className ?? ''}`}>
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveToolTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeToolTab === tab.id
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-hover text-text-secondary transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
