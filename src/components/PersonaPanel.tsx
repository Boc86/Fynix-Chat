import { useState } from 'react'
import { useUIStore } from '@/stores/chat-store'
import { usePersona } from '@/lib/hooks'

export function PersonaPanel() {
  const { setActivePanel } = useUIStore()
  const { persona, updatePersona, resetPersona } = usePersona()
  const [form, setForm] = useState({
    name: persona.name,
    description: persona.description,
    systemPrompt: persona.systemPrompt,
    temperature: persona.temperature,
    maxTokens: persona.maxTokens
  })
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updatePersona(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    await resetPersona()
    setForm({
      name: 'Chat Assistant',
      description: 'A helpful AI assistant',
      systemPrompt: 'You are a helpful, friendly, and knowledgeable AI assistant. Provide accurate and concise responses.',
      temperature: 0.7,
      maxTokens: 2048
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-tertiary">
        <h2 className="text-lg font-semibold text-text-primary">Bot Persona</h2>
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
          Configure your AI assistant's personality and behavior. These settings define how the bot responds and thinks.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">Bot Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="A brief description of your bot"
              className="w-full px-4 py-2.5 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              System Prompt
              <span className="text-text-muted font-normal ml-2">(Instructions that define behavior)</span>
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
              rows={8}
              placeholder="You are a helpful assistant that..."
              className="w-full px-4 py-3 bg-surface-secondary border-none rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            />
            <p className="text-xs text-text-muted mt-1">
              {form.systemPrompt.length} characters
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              Temperature: {form.temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
              className="w-full accent-accent-primary"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              Max Tokens: {form.maxTokens}
            </label>
            <input
              type="range"
              min="256"
              max="8192"
              step="256"
              value={form.maxTokens}
              onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))}
              className="w-full accent-accent-primary"
            />
            <p className="text-xs text-text-muted mt-1">
              Maximum length of the assistant's response
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-surface-tertiary space-y-2">
        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
        <button
          onClick={handleReset}
          className="w-full py-2.5 bg-surface-secondary hover:bg-surface-hover text-text-secondary rounded-lg font-medium transition-colors"
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}