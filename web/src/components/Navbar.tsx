import React from 'react'
import { Rocket, Cpu, HardDrive, Server, Plus, Activity } from 'lucide-react'
import type { SystemStats } from '../types'

interface NavbarProps {
  stats: SystemStats | null
  onOpenNewModal: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ stats, onOpenNewModal }) => {
  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatRAM = (usedMB?: number, totalMB?: number) => {
    if (!totalMB) return '0 GB'
    const usedGB = (usedMB || 0) / 1024
    const totalGB = totalMB / 1024
    return `${usedGB.toFixed(1)} / ${totalGB.toFixed(0)} GB`
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#090d16]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/20">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">Cosmodrome</span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                PaaS
              </span>
            </div>
            <p className="text-xs text-slate-400">Self-Hosted Linux Engine</p>
          </div>
        </div>

        {/* Real-time System Metrics */}
        {stats && (
          <div className="hidden items-center gap-2 md:flex">
            {/* CPU */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 shadow-inner">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>CPU</span>
              <span className="font-semibold text-white">
                {stats.cpu_usage_percent.toFixed(0)}%
              </span>
            </div>

            {/* RAM */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 shadow-inner">
              <Server className="h-3.5 w-3.5 text-purple-400" />
              <span>RAM</span>
              <span className="font-semibold text-white">
                {formatRAM(stats.mem_used_mb, stats.mem_total_mb)}
              </span>
            </div>

            {/* Disk */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 shadow-inner">
              <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
              <span>Disk</span>
              <span className="font-semibold text-white">
                {stats.disk_usage_percent.toFixed(0)}%
              </span>
            </div>

            {/* Host Uptime */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 shadow-inner">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Uptime</span>
              <span className="font-semibold text-white">
                {formatUptime(stats.system_uptime_sec)}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onOpenNewModal}
          className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] hover:shadow-indigo-600/40 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          <span>New Service</span>
        </button>
      </div>
    </header>
  )
}
