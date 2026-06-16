import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { useUserProfile } from '@/lib/hooks'

export function UserProfilePanel() {
  const { setActivePanel } = useUIStore()
  const { profile, updateProfile } = useUserProfile()
  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setContent(profile.content || '')
  }, [profile])

  const handleSave = async () => {
    await updateProfile({ content })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (confirm('Clear your user profile?')) {
      await updateProfile({ content: '' })
      setContent('')
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setContent(profile?.content || '')
    setIsEditing(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-tertiary">
        <h2 className="text-lg font-semibold text-text-primary">User Profile</h2>
        <div className="flex items-center gap-1">
          {!isEditing && profile?.content && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
              title="Edit profile"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {!isEditing && profile?.content && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-500"
              title="Clear profile"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setActivePanel('none')}
            className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-sm text-text-secondary">
          Describe yourself, your background, interests, and preferences. This context will be included in every conversation.
        </p>

        {isEditing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="# User Profile&#10;&#10;## Background&#10;...&#10;&#10;## Interests&#10;...&#10;&#10;## Expertise&#10;..."
            className="w-full h-full min-h-[300px] px-4 py-3 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none font-mono text-sm leading-relaxed"
          />
        ) : (
          <div className="w-full min-h-[300px] px-4 py-3 bg-surface-secondary rounded-lg text-text-primary font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {profile?.content || (
              <span className="text-text-muted italic">No profile set. Click the pencil icon to add your profile.</span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-surface-tertiary space-y-2">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
            >
              {saved ? 'Saved!' : 'Save Profile'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-surface-secondary hover:bg-surface-hover text-text-primary rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          !profile?.content && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
            >
              Create Profile
            </button>
          )
        )}
      </div>
    </div>
  )
}
