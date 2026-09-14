import React, { useState } from 'react'
import {
  X,
  Plus,
  Rocket,
  Globe,
  Terminal,
  Layers,
  Code2,
  Sparkles,
} from 'lucide-react'
import type { App, ServiceType } from '../types'
import { createApp } from '../api/client'

interface NewAppModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (app: App) => void
}

type TemplateType = 'node' | 'go' | 'react' | 'svelte' | 'custom'

export const NewAppModal: React.FC<NewAppModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('node')
  const [name, setName] = useState('')
  const [repoURL, setRepoURL] = useState('')
  const [branch, setBranch] = useState('main')
  const [rootDir, setRootDir] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('web_service')
  const [buildCmd, setBuildCmd] = useState('npm install')
  const [startCmd, setStartCmd] = useState('node index.js')
  const [outputDir, setOutputDir] = useState('dist')
  const [domain, setDomain] = useState('')
  const [autoDeploy, setAutoDeploy] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const applyTemplate = (t: TemplateType) => {
    setSelectedTemplate(t)
    switch (t) {
      case 'node':
        setServiceType('web_service')
        setBuildCmd('npm install')
        setStartCmd('node index.js')
        break
      case 'go':
        setServiceType('web_service')
        setBuildCmd('go build -o server .')
        setStartCmd('./server')
        break
      case 'react':
        setServiceType('static_site')
        setBuildCmd('npm install && npm run build')
        setOutputDir('dist')
        setStartCmd('')
        break
      case 'svelte':
        setServiceType('static_site')
        setBuildCmd('npm install && npm run build')
        setOutputDir('dist')
        setStartCmd('')
        break
      case 'custom':
        break
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const app = await createApp({
        name: name.trim(),
        repo_url: repoURL.trim(),
        branch: branch.trim() || 'main',
        root_dir: rootDir.trim(),
        service_type: serviceType,
        build_cmd: buildCmd.trim(),
        start_cmd: startCmd.trim(),
        output_dir: outputDir.trim() || 'dist',
        domain: domain.trim(),
        auto_deploy: autoDeploy,
      })
      onCreated(app)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f1c] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Service</h3>
              <p className="text-xs text-slate-400">Deploy from any Git repository in seconds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white border border-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Preset Templates */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Select Template
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { id: 'node', label: 'Node.js', desc: 'Web Service', icon: Terminal },
                { id: 'go', label: 'Go (Golang)', desc: 'Compiled Backend', icon: Code2 },
                { id: 'react', label: 'React (Vite)', desc: 'Static Frontend', icon: Globe },
                { id: 'svelte', label: 'Svelte (Vite)', desc: 'Static Frontend', icon: Layers },
              ].map((tmpl) => {
                const Icon = tmpl.icon
                const active = selectedTemplate === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => applyTemplate(tmpl.id as TemplateType)}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/10'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="mt-1.5 text-xs font-semibold">{tmpl.label}</span>
                    <span className="text-[10px] text-slate-500">{tmpl.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-300">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. backend-api or web-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-300">Git Repository URL *</label>
              <input
                type="text"
                required
                placeholder="https://github.com/user/repo or git@github.com:..."
                value={repoURL}
                onChange={(e) => setRepoURL(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Root Directory (optional)</label>
              <input
                type="text"
                placeholder="e.g. backend or frontend"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Domain / Subdomain</label>
              <input
                type="text"
                placeholder="e.g. api.yourdomain.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Build Command</label>
              <input
                type="text"
                placeholder="e.g. npm install && npm run build"
                value={buildCmd}
                onChange={(e) => setBuildCmd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {serviceType === 'web_service' ? (
              <div>
                <label className="text-xs font-medium text-slate-300">Start Command</label>
                <input
                  type="text"
                  placeholder="e.g. node index.js or ./server"
                  value={startCmd}
                  onChange={(e) => setStartCmd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-300">Static Output Directory</label>
                <input
                  type="text"
                  placeholder="dist"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Checkbox: Auto-deploy immediately */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoDeploy"
              checked={autoDeploy}
              onChange={(e) => setAutoDeploy(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="autoDeploy" className="text-xs text-slate-300 select-none">
              Deploy immediately upon creation
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.01] transition-all disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{loading ? 'Creating...' : 'Create & Deploy'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
