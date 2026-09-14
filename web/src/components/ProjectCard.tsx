import React from 'react'
import {
  Globe,
  GitBranch,
  Play,
  RotateCw,
  Square,
  ChevronRight,
  Clock,
  Terminal,
} from 'lucide-react'
import type { App } from '../types'

interface ProjectCardProps {
  app: App
  isSelected: boolean
  onSelect: (app: App) => void
  onDeploy: (id: string, e: React.MouseEvent) => void
  onRestart: (id: string, e: React.MouseEvent) => void
  onStop: (id: string, e: React.MouseEvent) => void
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  app,
  isSelected,
  onSelect,
  onDeploy,
  onRestart,
  onStop,
}) => {
  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return 'Offline'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m ${seconds % 60}s`
  }

  const getStatusBadge = () => {
    switch (app.status) {
      case 'running':
        return (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Running
          </div>
        )
      case 'building':
        return (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
            <RotateCw className="h-3 w-3 animate-spin" />
            Building
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Failed
          </div>
        )
      case 'stopped':
      default:
        return (
          <div className="flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-500/20">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Stopped
          </div>
        )
    }
  }

  const getTypeBadge = () => {
    const isStatic = app.service_type === 'static_site'
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
          isStatic
            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        }`}
      >
        {isStatic ? 'Static Frontend' : 'Web Backend'}
      </span>
    )
  }

  return (
    <div
      onClick={() => onSelect(app)}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-[#0d1322]/80 p-5 transition-all duration-200 hover:border-indigo-500/40 hover:bg-[#10182c] hover:shadow-xl hover:shadow-indigo-500/5 ${
        isSelected
          ? 'border-indigo-500 bg-[#121b33] ring-1 ring-indigo-500'
          : 'border-white/5'
      }`}
    >
      {/* Top row: Name & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/5 text-slate-200 group-hover:scale-105 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all">
            {app.service_type === 'static_site' ? (
              <Globe className="h-5 w-5" />
            ) : (
              <Terminal className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white group-hover:text-indigo-200 transition-colors">
                {app.name}
              </h3>
              {getTypeBadge()}
            </div>
            {/* Git Branch */}
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <GitBranch className="h-3.5 w-3.5 text-slate-500" />
              <span>{app.branch}</span>
              {app.port > 0 && app.service_type === 'web_service' && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-slate-400">:{app.port}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      {/* Domain / Target */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 overflow-hidden text-xs text-slate-400">
          <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          {app.domain ? (
            <a
              href={`http://${app.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate hover:text-indigo-400 hover:underline"
            >
              {app.domain}
            </a>
          ) : (
            <span className="italic text-slate-500">No domain configured</span>
          )}
        </div>

        {/* Uptime Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-medium">{formatUptime(app.uptime_sec)}</span>
        </div>
      </div>

      {/* Bottom Action Row */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Redeploy Button */}
          <button
            title="Trigger Redeploy"
            onClick={(e) => onDeploy(app.id, e)}
            className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 border border-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors"
          >
            <RotateCw className="h-3 w-3" />
            <span>Deploy</span>
          </button>

          {/* Restart Button (for web services) */}
          {app.service_type === 'web_service' && (
            <button
              title="Restart Process"
              onClick={(e) => onRestart(app.id, e)}
              className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <Play className="h-3 w-3" />
              <span>Restart</span>
            </button>
          )}

          {/* Stop Button */}
          {app.status === 'running' && app.service_type === 'web_service' && (
            <button
              title="Stop Process"
              onClick={(e) => onStop(app.id, e)}
              className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2 py-1.5 text-xs font-medium text-rose-400 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Expand arrow */}
        <div className="flex items-center text-xs font-medium text-slate-400 group-hover:text-indigo-400 transition-colors">
          <span>Details</span>
          <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
}
