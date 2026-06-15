import { useState } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { usePersonas } from '@/lib/hooks'
import type { Persona } from '@/types'

const defaultForm = { name: '', description: '', systemPrompt: '', temperature: 0.7, maxTokens: 2048 }

export function PersonaPanel() {
  const { setActivePanel, activePersonaId, setActivePersonaId } = useUIStore()
  const { personas, addPersona, updatePersona, deletePersona } = usePersonas()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof defaultForm>(defaultForm)

  const activePersona = personas.find(p => p.id === activePersonaId)

  const handleNew = () => {
    setEditingId('new')
    setForm(defaultForm)
  }

  const handleEdit = (p: Persona) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description,
      systemPrompt: p.systemPrompt,
      temperature: p.temperature,
      maxTokens: p.maxTokens
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editingId === 'new') {
      const id = await addPersona(form)
      setActivePersonaId(id)
    } else if (editingId) {
      await updatePersona(editingId, form)
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this persona?')) {
      await deletePersona(id)
      if (id === activePersonaId && personas.length > 1) {
        const next = personas.find(p => p.id !== id)
        if (next) setActivePersonaId(next.id)
      }
      if (editingId === id) setEditingId(null)
    }
  }

  const isEditing = editingId !== null

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-tertiary">
        <h2 className="text-lg font-semibold text-text-primary">Bot Personas</h2>
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
        {personas.length === 0 && !isEditing && (
          <div className="text-center py-8 text-text-muted text-sm">
            No personas yet. Create one to get started.
          </div>
        )}

        {!isEditing && personas.map(p => (
          <div
            key={p.id}
            className={`p-3 rounded-lg border transition-colors cursor-pointer ${
              p.id === activePersonaId
                ? 'border-accent-primary bg-accent-primary/5'
                : 'border-surface-tertiary bg-surface-secondary hover:border-accent-primary/50'
            }`}
            onClick={() => setActivePersonaId(p.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary text-sm">{p.name}</span>
                {p.id === activePersonaId && (
                  <span className="text-xs text-accent-primary font-medium">Active</span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                  className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {p.description && (
              <p className="text-xs text-text-muted truncate">{p.description}</p>
            )}
            <div className="flex gap-2 mt-1.5 text-xs text-text-muted">
              <span>{p.temperature.toFixed(1)} temp</span>
              <span>{p.maxTokens} tokens</span>
            </div>
          </div>
        ))}

        {isEditing && (
          <div className="space-y-4 bg-surface-secondary p-4 rounded-lg border border-surface-tertiary">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-primary border border-surface-tertiary rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-primary border border-surface-tertiary rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">System Prompt</label>
              <textarea
                value={form.systemPrompt}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 bg-surface-primary border border-surface-tertiary rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Temperature: {form.temperature.toFixed(1)}</label>
              <input
                type="range" min="0" max="2" step="0.1"
                value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Max Tokens: {form.maxTokens}</label>
              <input
                type="range" min="256" max="8192" step="256"
                value={form.maxTokens}
                onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))}
                className="w-full accent-accent-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="flex-1 py-2 bg-accent-primary hover:bg-accent-secondary disabled:bg-surface-tertiary disabled:text-text-muted text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 bg-surface-tertiary hover:bg-surface-hover text-text-secondary rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-surface-tertiary">
        {!isEditing && (
          <button
            onClick={handleNew}
            className="w-full py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
          >
            + New Persona
          </button>
        )}
        {activePersona && (
          <p className="text-xs text-text-muted text-center mt-2">
            Active: <span className="text-text-primary font-medium">{activePersona.name}</span>
          </p>
        )}
      </div>
    </div>
  )
}
