package database

import "time"

// ServiceType defines whether an app is a long-running backend service or a static site.
type ServiceType string

const (
	TypeWebService ServiceType = "web_service" // Node.js, Go, etc.
	TypeStaticSite ServiceType = "static_site" // React, Svelte, Vite dist, etc.
)

// AppStatus defines the current runtime status of an application.
type AppStatus string

const (
	StatusIdle     AppStatus = "idle"
	StatusBuilding AppStatus = "building"
	StatusRunning  AppStatus = "running"
	StatusStopped  AppStatus = "stopped"
	StatusFailed   AppStatus = "failed"
)

// App represents a deployed application in Cosmodrome.
type App struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	RepoURL       string            `json:"repo_url"`
	Branch        string            `json:"branch"`
	RootDir       string            `json:"root_dir"`
	ServiceType   ServiceType       `json:"service_type"` // web_service or static_site
	BuildCmd      string            `json:"build_cmd"`     // e.g. "npm run build" or "go build -o server"
	StartCmd      string            `json:"start_cmd"`     // e.g. "node server.js" or "./server"
	Port          int               `json:"port"`          // Assigned internal port
	Domain        string            `json:"domain"`        // e.g. "api.myhome.com"
	OutputDir     string            `json:"output_dir"`    // for static sites, e.g. "dist"
	EnvVars       map[string]string `json:"env_vars"`      // Key-value environment variables
	Status        AppStatus         `json:"status"`
	PID           int               `json:"pid,omitempty"`
	StartedAt     *time.Time        `json:"started_at,omitempty"`
	UptimeSec     int64             `json:"uptime_sec"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	LastCommit    string            `json:"last_commit,omitempty"`
	LastCommitMsg string            `json:"last_commit_msg,omitempty"`
}

// Deployment represents a single build & deploy execution.
type Deployment struct {
	ID          string     `json:"id"`
	AppID       string     `json:"app_id"`
	CommitHash  string     `json:"commit_hash"`
	CommitMsg   string     `json:"commit_msg"`
	Status      string     `json:"status"` // "queued", "building", "success", "failed"
	Logs        string     `json:"logs,omitempty"`
	StartedAt   time.Time  `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
	DurationSec int64      `json:"duration_sec"`
}
