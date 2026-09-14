export type ServiceType = 'web_service' | 'static_site'

export type AppStatus = 'idle' | 'building' | 'running' | 'stopped' | 'failed'

export interface App {
  id: string
  name: string
  repo_url: string
  branch: string
  root_dir: string
  service_type: ServiceType
  build_cmd: string
  start_cmd: string
  port: number
  domain: string
  output_dir: string
  env_vars: Record<string, string>
  status: AppStatus
  pid?: number
  started_at?: string
  uptime_sec: number
  created_at: string
  updated_at: string
  last_commit?: string
  last_commit_msg?: string
}

export interface Deployment {
  id: string
  app_id: string
  commit_hash: string
  commit_msg: string
  status: 'queued' | 'building' | 'success' | 'failed'
  logs?: string
  started_at: string
  ended_at?: string
  duration_sec: number
}

export interface SystemStats {
  cpu_usage_percent: number
  cpu_cores: number
  mem_total_mb: number
  mem_used_mb: number
  mem_free_mb: number
  mem_usage_percent: number
  disk_total_gb: number
  disk_used_gb: number
  disk_free_gb: number
  disk_usage_percent: number
  system_uptime_sec: number
  server_uptime_sec: number
  os: string
  go_version: string
  active_apps: number
  total_apps: number
}

export interface LogLine {
  timestamp: string
  stream: 'stdout' | 'stderr' | 'system'
  content: string
}
