import { useState } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { useUserProfile } from '@/lib/hooks'

export function UserProfilePanel() {
  const { setActivePanel } = useUIStore()
  const { profile, updateProfile } = useUserProfile()
  const [content, setContent] = useState(profile?.content || '')
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updateProfile({ content })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-tertiary">
        <h2 className="text-lg font-semibold text-text-primary">User Profile</h2>
        <button
          onClick={() => setActivePanel('none')}
          className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-sm text-text-secondary">
          Describe yourself, your background, interests, and preferences. This context will be included in every conversation.
        </p>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="# User Profile&#10;&#10;## Background&#10;...&#10;&#10;## Interests&#10;...&#10;&#10;## Expertise&#10;..."
          className="w-full h-full min-h-[300px] px-4 py-3 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none font-mono text-sm leading-relaxed"
        />
      </div>

      <div className="p-4 border-t border-surface-tertiary">
        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
        >
          {saved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
