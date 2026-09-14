import React, { useState, useEffect } from 'react'
import {
  Terminal,
  History,
  KeyRound,
  Settings,
  X,
  RotateCw,
  Play,
  Square,
  Trash2,
  Globe,
  GitBranch,
  Save,
  Check,
  Clock,
  ExternalLink,
} from 'lucide-react'
import type { App, Deployment } from '../types'
import { TerminalLogs } from './TerminalLogs'
import { EnvEditor } from './EnvEditor'
import { fetchDeployments, updateApp, deleteApp } from '../api/client'

interface ProjectDetailProps {
  app: App
  onClose: () => void
  onRefresh: () => void
  onDeploy: (id: string) => void
  onRestart: (id: string) => void
  onStop: (id: string) => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  app,
  onClose,
  onRefresh,
  onDeploy,
  onRestart,
  onStop,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'deployments' | 'env' | 'settings'>('logs')
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loadingDeploys, setLoadingDeploys] = useState(false)

  // Settings form state
  const [formData, setFormData] = useState({
    name: app.name,
    repo_url: app.repo_url,
    branch: app.branch,
    root_dir: app.root_dir,
    build_cmd: app.build_cmd,
    start_cmd: app.start_cmd,
    output_dir: app.output_dir,
    domain: app.domain,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettings, setSavedSettings] = useState(false)

  useEffect(() => {
    if (activeTab === 'deployments') {
      setLoadingDeploys(true)
      fetchDeployments(app.id)
        .then(setDeployments)
        .catch(() => setDeployments([]))
        .finally(() => setLoadingDeploys(false))
    }
  }, [activeTab, app.id])

  const handleSaveEnv = async (newEnv: Record<string, string>) => {
    await updateApp(app.id, { env_vars: newEnv })
    onRefresh()
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await updateApp(app.id, formData)
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2500)
      onRefresh()
    } finally {
      setSavingSettings(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to completely delete "${app.name}"?`)) {
      await deleteApp(app.id)
      onClose()
      onRefresh()
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return 'Offline'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m ${seconds % 60}s`
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f1c]/95 shadow-2xl backdrop-blur-xl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{app.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  app.status === 'running'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : app.status === 'building'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                }`}
              >
                {app.status.toUpperCase()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="h-3 w-3 text-slate-500" />
                {app.branch}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-indigo-400" />
                Uptime: <strong className="text-slate-200">{formatUptime(app.uptime_sec)}</strong>
              </span>
              {app.port > 0 && app.service_type === 'web_service' && (
                <>
                  <span>•</span>
                  <span>Port: <strong className="font-mono text-slate-200">{app.port}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          {app.domain && (
            <a
              href={`http://${app.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
              <span>Visit</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </a>
          )}

          <button
            onClick={() => onDeploy(app.id)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Deploy</span>
          </button>

          {app.service_type === 'web_service' && (
            <button
              onClick={() => onRestart(app.id)}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Restart</span>
            </button>
          )}

          {app.status === 'running' && app.service_type === 'web_service' && (
            <button
              onClick={() => onStop(app.id)}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-rose-400 border border-white/5 hover:bg-rose-500/10 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white border border-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#070b14] px-6 py-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Live Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'deployments'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Deployments</span>
        </button>

        <button
          onClick={() => setActiveTab('env')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'env'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Environment</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'logs' && (
          <div className="h-[520px]">
            <TerminalLogs appId={app.id} appName={app.name} />
          </div>
        )}

        {activeTab === 'deployments' && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Deployment History</h4>
            {loadingDeploys ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading deployments...</div>
            ) : deployments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                No deployments yet. Click &quot;Deploy&quot; to initiate the first build.
              </div>
            ) : (
              deployments.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1322]/80 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-2.5 w-2.5 rounded-full ${
                        d.status === 'success'
                          ? 'bg-emerald-400'
                          : d.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white">
                          {d.commit_hash ? d.commit_hash.slice(0, 7) : 'Manual'}
                        </span>
                        <span className="text-xs text-slate-300">
                          {d.commit_msg || 'Deployment triggered'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {new Date(d.started_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span
                      className={`font-semibold capitalize ${
                        d.status === 'success'
                          ? 'text-emerald-400'
                          : d.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {d.status}
                    </span>
                    <div className="text-[11px] text-slate-500">{d.duration_sec}s</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'env' && (
          <EnvEditor initialEnv={app.env_vars} onSave={handleSaveEnv} />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* General Settings */}
            <form onSubmit={handleSaveSettings} className="rounded-2xl border border-white/5 bg-[#0d1322]/80 p-6">
              <h4 className="text-sm font-semibold text-white border-b border-white/5 pb-3">
                Build & Runtime Configuration
              </h4>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-400">Service Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">Git Branch</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Git Repository URL</label>
                  <input
                    type="text"
                    value={formData.repo_url}
                    onChange={(e) => setFormData({ ...formData, repo_url: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">Root Directory</label>
                  <input
                    type="text"
                    placeholder="e.g. backend or frontend (blank for root)"
                    value={formData.root_dir}
                    onChange={(e) => setFormData({ ...formData, root_dir: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">Custom Domain / Subdomain</label>
                  <input
                    type="text"
                    placeholder="e.g. api.myhome.com or myapp.yourdomain.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">Build Command</label>
                  <input
                    type="text"
                    placeholder="e.g. npm install && npm run build or go build -o app"
                    value={formData.build_cmd}
                    onChange={(e) => setFormData({ ...formData, build_cmd: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {app.service_type === 'web_service' ? (
                  <div>
                    <label className="text-xs font-medium text-slate-400">Start Command</label>
                    <input
                      type="text"
                      placeholder="e.g. node dist/index.js or ./app"
                      value={formData.start_cmd}
                      onChange={(e) => setFormData({ ...formData, start_cmd: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-slate-400">Static Output Directory</label>
                    <input
                      type="text"
                      placeholder="e.g. dist or build"
                      value={formData.output_dir}
                      onChange={(e) => setFormData({ ...formData, output_dir: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {savedSettings ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Settings Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Cloudflare Tunnel Ingress Notice */}
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
              <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wide">
                <Globe className="h-4 w-4" />
                Cloudflare Tunnel Routing
              </h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                When you assign domain <strong className="text-white font-mono">{formData.domain || 'your-domain.com'}</strong> to this service,
                ensure your Cloudflare Tunnel points traffic to port <strong className="text-white font-mono">8080</strong> (Cosmodrome Proxy).
                Cosmodrome inspects the Host header and automatically routes it to this service!
              </p>
            </div>

            {/* Danger Zone */}
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wide">Danger Zone</h4>
              <p className="mt-1 text-xs text-slate-400">
                Permanently stop the process, remove disk files, and delete this application.
              </p>
              <button
                type="button"
                onClick={handleDelete}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-rose-600/20 px-3.5 py-2 text-xs font-semibold text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Application</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
