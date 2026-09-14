import React, { useState, useEffect, useRef } from 'react'
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  Filter,
} from 'lucide-react'
import type { LogLine } from '../types'
import { subscribeLogs } from '../api/client'

interface TerminalLogsProps {
  appId: string
  appName: string
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ appId, appName }) => {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<'all' | 'stdout' | 'stderr' | 'system'>('all')
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLogs([])
    const unsubscribe = subscribeLogs(appId, (log) => {
      setLogs((prev) => [...prev.slice(-1500), log])
    })
    return () => unsubscribe()
  }, [appId])

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleCopy = () => {
    const text = logs.map((l) => `[${l.stream}] ${l.content}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true
    return l.stream === filter
  })

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#060a12] shadow-2xl">
      {/* Terminal Top Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-[#0a0f1c]/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white">Live Stream:</span>
          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-mono text-indigo-300 border border-indigo-500/20">
            {appName}
          </span>
          <span className="flex h-2 w-2 relative ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Stream Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 text-[11px] border border-white/5">
            <Filter className="h-3 w-3 ml-1 text-slate-400" />
            {(['all', 'stdout', 'stderr', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2 py-0.5 font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Auto Scroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium border transition-colors ${
              autoScroll
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'bg-white/[0.04] text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <ArrowDown className="h-3 w-3" />
            <span>Auto-scroll</span>
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-300 border border-white/5 hover:bg-white/10 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-rose-400 border border-white/5 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-slate-500">
            <TerminalIcon className="h-8 w-8 mb-2 opacity-40" />
            <p>No output logs yet. Trigger a deploy to view live build & runtime output.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, idx) => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString()
              let streamColor = 'text-slate-300'
              if (log.stream === 'system') streamColor = 'text-cyan-400 font-semibold'
              if (log.stream === 'stderr') streamColor = 'text-rose-400'

              return (
                <div key={idx} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 rounded">
                  <span className="select-none text-slate-600 shrink-0 font-mono text-[10px] mt-0.5">
                    {timeStr}
                  </span>
                  <span
                    className={`select-none shrink-0 uppercase text-[9px] font-bold px-1 py-0.2 rounded border ${
                      log.stream === 'system'
                        ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
                        : log.stream === 'stderr'
                        ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {log.stream}
                  </span>
                  <pre className={`whitespace-pre-wrap break-all flex-1 ${streamColor}`}>
                    {log.content}
                  </pre>
                </div>
              )
            })}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
