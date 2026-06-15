import { useState } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { useUserProfile } from '@/lib/hooks'

export function UserProfilePanel() {
  const { setActivePanel } = useUIStore()
  const { profile, updateProfile } = useUserProfile()
  const [form, setForm] = useState({
    name: profile?.name || '',
    background: profile?.background || '',
    interests: profile?.interests || '',
    expertise: profile?.expertise || '',
    location: profile?.location || ''
  })
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updateProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Loading...
      </div>
    )
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <p className="text-sm text-text-secondary">
          Share information about yourself so the AI can tailor responses to your context.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Background</label>
            <input
              type="text"
              value={form.background}
              onChange={e => setForm(f => ({ ...f, background: e.target.value }))}
              placeholder="e.g. Software engineer, student, researcher"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Interests</label>
            <input
              type="text"
              value={form.interests}
              onChange={e => setForm(f => ({ ...f, interests: e.target.value }))}
              placeholder="e.g. Machine learning, photography, hiking"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Expertise</label>
            <input
              type="text"
              value={form.expertise}
              onChange={e => setForm(f => ({ ...f, expertise: e.target.value }))}
              placeholder="e.g. Python, React, Data analysis"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. San Francisco, CA"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>
        </div>
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
