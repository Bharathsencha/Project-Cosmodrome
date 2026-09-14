import type { App, Deployment, LogLine, SystemStats } from '../types'

const API_BASE = '/api'

export async function fetchSystemStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/system`)
  if (!res.ok) throw new Error('Failed to fetch system stats')
  return res.json()
}

export async function fetchApps(): Promise<App[]> {
  const res = await fetch(`${API_BASE}/apps`)
  if (!res.ok) throw new Error('Failed to fetch apps')
  return res.json()
}

export async function fetchApp(id: string): Promise<App> {
  const res = await fetch(`${API_BASE}/apps/${id}`)
  if (!res.ok) throw new Error('Failed to fetch app')
  return res.json()
}

export async function createApp(payload: Partial<App> & { auto_deploy?: boolean }): Promise<App> {
  const res = await fetch(`${API_BASE}/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create app')
  }
  return res.json()
}

export async function updateApp(id: string, payload: Partial<App>): Promise<App> {
  const res = await fetch(`${API_BASE}/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update app')
  }
  return res.json()
}

export async function deleteApp(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/apps/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete app')
}

export async function deployApp(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/apps/${id}/deploy`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to trigger deployment')
}

export async function restartApp(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/apps/${id}/restart`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to restart app')
}

export async function stopApp(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/apps/${id}/stop`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to stop app')
}

export async function fetchDeployments(id: string): Promise<Deployment[]> {
  const res = await fetch(`${API_BASE}/apps/${id}/deployments`)
  if (!res.ok) throw new Error('Failed to fetch deployments')
  return res.json()
}

export function subscribeLogs(appID: string, onMessage: (log: LogLine) => void): () => void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws/logs/${appID}`
  const ws = new WebSocket(wsUrl)

  ws.onmessage = (event) => {
    try {
      const line = JSON.parse(event.data) as LogLine
      onMessage(line)
    } catch {
      // ignore parse errors
    }
  }

  return () => {
    ws.close()
  }
}
