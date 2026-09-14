import React, { useState, useEffect } from 'react'
import {
  Rocket,
  Search,
  RefreshCw,
  Plus,
  Terminal,
  Globe,
  Sparkles,
} from 'lucide-react'
import type { App, SystemStats } from './types'
import {
  fetchApps,
  fetchSystemStats,
  deployApp,
  restartApp,
  stopApp,
} from './api/client'
import { Navbar } from './components/Navbar'
import { ProjectCard } from './components/ProjectCard'
import { ProjectDetail } from './components/ProjectDetail'
import { NewAppModal } from './components/NewAppModal'

export const AppRoot: React.FC = () => {
  const [apps, setApps] = useState<App[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'building' | 'stopped'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'web_service' | 'static_site'>('all')
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [appsData, statsData] = await Promise.all([
        fetchApps().catch(() => []),
        fetchSystemStats().catch(() => null),
      ])
      setApps(appsData)
      setStats(statsData)

      // Keep selected app in sync
      if (selectedApp) {
        const updated = appsData.find((a) => a.id === selectedApp.id)
        if (updated) {
          setSelectedApp(updated)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 3000)
    return () => clearInterval(interval)
  }, [selectedApp?.id])

  const handleDeploy = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await deployApp(id)
    loadData()
  }

  const handleRestart = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await restartApp(id)
    loadData()
  }

  const handleStop = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await stopApp(id)
    loadData()
  }

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.repo_url.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'running' && app.status === 'running') ||
      (statusFilter === 'building' && app.status === 'building') ||
      (statusFilter === 'stopped' && (app.status === 'stopped' || app.status === 'idle' || app.status === 'failed'))

    const matchesType = typeFilter === 'all' || app.service_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar stats={stats} onOpenNewModal={() => setIsNewModalOpen(true)} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* Banner Section */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/40 p-6 sm:p-8 backdrop-blur-md">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  AMD Ryzen 7 5700X • 64 GB RAM Server
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Services & Deployments
              </h1>
              <p className="mt-1 text-xs text-slate-400 max-w-xl">
                Self-hosted platform for Node.js, Go, React, and Svelte. Connected to Cloudflare Tunnels for zero-configuration public URLs.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadData()}
                className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setIsNewModalOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Deploy New Service</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search projects, domains, repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/5 bg-[#0d1322]/90 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filters */}
            <div className="flex items-center gap-1 rounded-2xl border border-white/5 bg-[#0d1322]/80 p-1 text-xs">
              {(['all', 'running', 'building', 'stopped'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-xl px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1 rounded-2xl border border-white/5 bg-[#0d1322]/80 p-1 text-xs">
              <button
                onClick={() => setTypeFilter('all')}
                className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('web_service')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === 'web_service'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="h-3 w-3" />
                <span>Backends</span>
              </button>
              <button
                onClick={() => setTypeFilter('static_site')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === 'static_site'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="h-3 w-3" />
                <span>Frontends</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected App Expanded View */}
        {selectedApp && (
          <div className="mb-8">
            <ProjectDetail
              app={selectedApp}
              onClose={() => setSelectedApp(null)}
              onRefresh={loadData}
              onDeploy={(id) => handleDeploy(id)}
              onRestart={(id) => handleRestart(id)}
              onStop={(id) => handleStop(id)}
            />
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
              <span>Loading projects...</span>
            </div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#0d1322]/40 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Rocket className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">No services deployed yet</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Deploy your first Node.js, Go backend or React, Svelte frontend. Changes are auto-built and exposed via Cloudflare.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Your First Service</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredApps.map((app) => (
              <ProjectCard
                key={app.id}
                app={app}
                isSelected={selectedApp?.id === app.id}
                onSelect={(a) => setSelectedApp(selectedApp?.id === a.id ? null : a)}
                onDeploy={handleDeploy}
                onRestart={handleRestart}
                onStop={handleStop}
              />
            ))}
          </div>
        )}
      </main>

      {/* New App Modal */}
      <NewAppModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={(newApp) => {
          loadData()
          setSelectedApp(newApp)
        }}
      />
    </div>
  )
}

export default AppRoot
