import { useState } from 'react'
import { useUIStore, useConfigStore } from '@/stores/chat-store'
import { usePreferences, useApiConfigs } from '@/lib/hooks'
import type { ApiConfig } from '@/types'

export function SettingsPanel() {
  const { setActivePanel, setTheme, setFontSize } = useUIStore()
  const { preferences, updatePreferences } = usePreferences()
  const { configs, addApiConfig, updateApiConfig, deleteApiConfig, setDefaultConfig } = useApiConfigs()
  const { apiConfig, setApiConfig } = useConfigStore()

  const [showAddConfig, setShowAddConfig] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null)
  const [configForm, setConfigForm] = useState({
    name: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    searchModel: '',
    isDefault: false
  })

  const handleSaveConfig = async () => {
    try {
      if (editingConfig) {
        await updateApiConfig(editingConfig.id, configForm)
        if (apiConfig?.id === editingConfig.id) {
          setApiConfig({ ...editingConfig, ...configForm })
        }
      } else {
        const id = await addApiConfig(configForm)
        if (configForm.isDefault) {
          await setDefaultConfig(id)
        }
        if (configs.length === 0) {
          setApiConfig({ ...configForm, id })
        }
      }
      setShowAddConfig(false)
      setEditingConfig(null)
      setConfigForm({ name: '', apiKey: '', baseUrl: '', model: '', searchModel: '', isDefault: false })
    } catch (err) {
      alert(`Failed to save config: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleEditConfig = (config: ApiConfig) => {
    setEditingConfig(config)
    setConfigForm({
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      searchModel: config.searchModel,
      isDefault: config.isDefault
    })
    setShowAddConfig(true)
  }

  const handleDeleteConfig = async (id: string) => {
    await deleteApiConfig(id)
    if (apiConfig?.id === id) {
      const remaining = configs.find(c => c.id !== id)
      setApiConfig(remaining || null)
    }
  }

  const handleSetDefault = async (id: string) => {
    await setDefaultConfig(id)
    const config = configs.find(c => c.id === id)
    if (config) setApiConfig(config)
  }

  const handleSelectConfig = (config: ApiConfig) => {
    setApiConfig(config)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-tertiary">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
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
        <section>
          <h3 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">Appearance</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">Theme</label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t)
                      updatePreferences({ theme: t })
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      preferences.theme === t
                        ? 'bg-accent-primary text-white'
                        : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">Font Size</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setFontSize(s)
                      updatePreferences({ fontSize: s })
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      preferences.fontSize === s
                        ? 'bg-accent-primary text-white'
                        : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">Chat Options</h3>

          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Enable streaming</span>
              <button
                onClick={() => updatePreferences({ streaming: !preferences.streaming })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.streaming ? 'bg-accent-primary' : 'bg-surface-tertiary'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.streaming ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Sound effects</span>
              <button
                onClick={() => updatePreferences({ soundEnabled: !preferences.soundEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.soundEnabled ? 'bg-accent-primary' : 'bg-surface-tertiary'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">API Configuration</h3>
            <button
              onClick={() => {
                setEditingConfig(null)
      setConfigForm({ name: '', apiKey: '', baseUrl: '', model: '', searchModel: '', isDefault: false })
                setShowAddConfig(true)
              }}
              className="text-accent-primary hover:text-accent-secondary text-sm font-medium"
            >
              + Add
            </button>
          </div>

          {showAddConfig && (
            <div className="mb-4 p-4 bg-surface-secondary rounded-lg space-y-3">
              <input
                type="text"
                placeholder="Config name (e.g., My NIM)"
                value={configForm.name}
                onChange={e => setConfigForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <input
                type="password"
                placeholder="API Key"
                value={configForm.apiKey}
                onChange={e => setConfigForm(f => ({ ...f, apiKey: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <input
                type="text"
                placeholder="Base URL (e.g., https://integrate.api.nvidia.com/v1 — do NOT include /chat/completions)"
                value={configForm.baseUrl}
                onChange={e => setConfigForm(f => ({ ...f, baseUrl: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <input
                type="text"
                placeholder="Chat model (e.g., meta/llama-3.1-405b-instruct)"
                value={configForm.model}
                onChange={e => setConfigForm(f => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <input
                type="text"
                placeholder="Search model — used when web search is on (e.g., meta/llama-3.1-70b-instruct)"
                value={configForm.searchModel}
                onChange={e => setConfigForm(f => ({ ...f, searchModel: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-tertiary border-none rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.isDefault}
                  onChange={e => setConfigForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-text-primary">Set as default</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-secondary"
                >
                  {editingConfig ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowAddConfig(false)
                    setEditingConfig(null)
                  }}
                  className="px-4 py-2 bg-surface-tertiary text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {configs.map(config => (
              <div
                key={config.id}
                onClick={() => handleSelectConfig(config)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  apiConfig?.id === config.id
                    ? 'bg-accent-primary/10 border border-accent-primary/30'
                    : 'bg-surface-secondary hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-text-primary text-sm">{config.name}</span>
                  <div className="flex gap-1">
                    {config.isDefault && (
                      <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded">Default</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditConfig(config)
                      }}
                      className="p-1 hover:bg-surface-tertiary rounded text-text-muted"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteConfig(config.id)
                      }}
                      className="p-1 hover:bg-surface-tertiary rounded text-text-muted hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="text-xs text-text-muted truncate">{config.baseUrl}</div>
                <div className="text-xs text-text-muted truncate">{config.model}</div>
                {config.searchModel && (
                  <div className="text-xs text-text-muted/60 truncate">Search: {config.searchModel}</div>
                )}
                {!config.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSetDefault(config.id)
                    }}
                    className="mt-2 text-xs text-accent-primary hover:text-accent-secondary"
                  >
                    Set as default
                  </button>
                )}
              </div>
            ))}

            {configs.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">
                No API configurations yet. Add one to get started.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}