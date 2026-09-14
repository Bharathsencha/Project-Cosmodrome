import React, { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Save, Check } from 'lucide-react'

interface EnvEditorProps {
  initialEnv: Record<string, string>
  onSave: (env: Record<string, string>) => Promise<void>
}

interface EnvPair {
  key: string
  value: string
  showSecret: boolean
}

export const EnvEditor: React.FC<EnvEditorProps> = ({ initialEnv, onSave }) => {
  const [pairs, setPairs] = useState<EnvPair[]>(() => {
    return Object.entries(initialEnv).map(([key, value]) => ({
      key,
      value,
      showSecret: false,
    }))
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleAdd = () => {
    setPairs([...pairs, { key: '', value: '', showSecret: true }])
  }

  const handleRemove = (index: number) => {
    setPairs(pairs.filter((_, i) => i !== index))
  }

  const handleKeyChange = (index: number, key: string) => {
    const updated = [...pairs]
    updated[index].key = key
    setPairs(updated)
  }

  const handleValueChange = (index: number, value: string) => {
    const updated = [...pairs]
    updated[index].value = value
    setPairs(updated)
  }

  const toggleShow = (index: number) => {
    const updated = [...pairs]
    updated[index].showSecret = !updated[index].showSecret
    setPairs(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    const result: Record<string, string> = {}
    for (const p of pairs) {
      const trimmedKey = p.key.trim()
      if (trimmedKey) {
        result[trimmedKey] = p.value
      }
    }
    try {
      await onSave(result)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0d1322]/80 p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h4 className="font-semibold text-white">Environment Variables</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure secrets, Supabase keys, MongoDB URIs, and database connection strings.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Variable</span>
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {pairs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
            No environment variables configured. Click &quot;Add Variable&quot; to inject database URLs or secrets.
          </div>
        ) : (
          pairs.map((pair, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {/* Key Input */}
              <input
                type="text"
                placeholder="VARIABLE_NAME"
                value={pair.key}
                onChange={(e) => handleKeyChange(idx, e.target.value)}
                className="w-1/3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />

              {/* Value Input */}
              <div className="relative flex-1">
                <input
                  type={pair.showSecret ? 'text' : 'password'}
                  placeholder="value (e.g. mongodb+srv://... or secret)"
                  value={pair.value}
                  onChange={(e) => handleValueChange(idx, e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 pr-10 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => toggleShow(idx)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {pair.showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 border border-white/5 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {pairs.length > 0 && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Saved & Applied!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
