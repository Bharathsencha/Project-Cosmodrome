package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// Store encapsulates SQLite database operations for Cosmodrome.
type Store struct {
	db *sql.DB
	mu sync.RWMutex
}

// InitDB initializes the SQLite database and runs migrations.
func InitDB(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return store, nil
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS apps (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		repo_url TEXT NOT NULL,
		branch TEXT NOT NULL DEFAULT 'main',
		root_dir TEXT NOT NULL DEFAULT '',
		service_type TEXT NOT NULL,
		build_cmd TEXT NOT NULL DEFAULT '',
		start_cmd TEXT NOT NULL DEFAULT '',
		port INTEGER NOT NULL DEFAULT 0,
		domain TEXT NOT NULL DEFAULT '',
		output_dir TEXT NOT NULL DEFAULT 'dist',
		env_vars TEXT NOT NULL DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'idle',
		pid INTEGER NOT NULL DEFAULT 0,
		started_at DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		last_commit TEXT NOT NULL DEFAULT '',
		last_commit_msg TEXT NOT NULL DEFAULT ''
	);

	CREATE INDEX IF NOT EXISTS idx_apps_domain ON apps(domain);

	CREATE TABLE IF NOT EXISTS deployments (
		id TEXT PRIMARY KEY,
		app_id TEXT NOT NULL,
		commit_hash TEXT NOT NULL DEFAULT '',
		commit_msg TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'queued',
		logs TEXT NOT NULL DEFAULT '',
		started_at DATETIME NOT NULL,
		ended_at DATETIME,
		duration_sec INTEGER NOT NULL DEFAULT 0,
		FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_deployments_app_id ON deployments(app_id);
	`
	_, err := s.db.Exec(schema)
	return err
}

// Close closes the database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// GetApps returns all registered applications.
func (s *Store) GetApps() ([]*App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, name, repo_url, branch, root_dir, service_type, build_cmd, start_cmd,
	          port, domain, output_dir, env_vars, status, pid, started_at, created_at, updated_at,
	          last_commit, last_commit_msg FROM apps ORDER BY created_at DESC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []*App
	for rows.Next() {
		var a App
		var envJSON string
		var startedAt sql.NullTime

		err := rows.Scan(
			&a.ID, &a.Name, &a.RepoURL, &a.Branch, &a.RootDir, &a.ServiceType,
			&a.BuildCmd, &a.StartCmd, &a.Port, &a.Domain, &a.OutputDir, &envJSON,
			&a.Status, &a.PID, &startedAt, &a.CreatedAt, &a.UpdatedAt,
			&a.LastCommit, &a.LastCommitMsg,
		)
		if err != nil {
			return nil, err
		}

		_ = json.Unmarshal([]byte(envJSON), &a.EnvVars)
		if a.EnvVars == nil {
			a.EnvVars = make(map[string]string)
		}

		if startedAt.Valid {
			a.StartedAt = &startedAt.Time
			if a.Status == StatusRunning {
				a.UptimeSec = int64(time.Since(startedAt.Time).Seconds())
			}
		}

		apps = append(apps, &a)
	}

	return apps, nil
}

// GetApp retrieves an app by ID.
func (s *Store) GetApp(id string) (*App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, name, repo_url, branch, root_dir, service_type, build_cmd, start_cmd,
	          port, domain, output_dir, env_vars, status, pid, started_at, created_at, updated_at,
	          last_commit, last_commit_msg FROM apps WHERE id = ?`

	row := s.db.QueryRow(query, id)

	var a App
	var envJSON string
	var startedAt sql.NullTime

	err := row.Scan(
		&a.ID, &a.Name, &a.RepoURL, &a.Branch, &a.RootDir, &a.ServiceType,
		&a.BuildCmd, &a.StartCmd, &a.Port, &a.Domain, &a.OutputDir, &envJSON,
		&a.Status, &a.PID, &startedAt, &a.CreatedAt, &a.UpdatedAt,
		&a.LastCommit, &a.LastCommitMsg,
	)
	if err != nil {
		return nil, err
	}

	_ = json.Unmarshal([]byte(envJSON), &a.EnvVars)
	if a.EnvVars == nil {
		a.EnvVars = make(map[string]string)
	}

	if startedAt.Valid {
		a.StartedAt = &startedAt.Time
		if a.Status == StatusRunning {
			a.UptimeSec = int64(time.Since(startedAt.Time).Seconds())
		}
	}

	return &a, nil
}

// GetAppByDomain retrieves an app by assigned domain.
func (s *Store) GetAppByDomain(domain string) (*App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, name, repo_url, branch, root_dir, service_type, build_cmd, start_cmd,
	          port, domain, output_dir, env_vars, status, pid, started_at, created_at, updated_at,
	          last_commit, last_commit_msg FROM apps WHERE domain = ?`

	row := s.db.QueryRow(query, domain)

	var a App
	var envJSON string
	var startedAt sql.NullTime

	err := row.Scan(
		&a.ID, &a.Name, &a.RepoURL, &a.Branch, &a.RootDir, &a.ServiceType,
		&a.BuildCmd, &a.StartCmd, &a.Port, &a.Domain, &a.OutputDir, &envJSON,
		&a.Status, &a.PID, &startedAt, &a.CreatedAt, &a.UpdatedAt,
		&a.LastCommit, &a.LastCommitMsg,
	)
	if err != nil {
		return nil, err
	}

	_ = json.Unmarshal([]byte(envJSON), &a.EnvVars)
	if a.EnvVars == nil {
		a.EnvVars = make(map[string]string)
	}

	if startedAt.Valid {
		a.StartedAt = &startedAt.Time
		if a.Status == StatusRunning {
			a.UptimeSec = int64(time.Since(startedAt.Time).Seconds())
		}
	}

	return &a, nil
}

// CreateApp inserts a new application.
func (s *Store) CreateApp(app *App) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	envJSON, _ := json.Marshal(app.EnvVars)
	now := time.Now()
	app.CreatedAt = now
	app.UpdatedAt = now

	query := `INSERT INTO apps (
		id, name, repo_url, branch, root_dir, service_type, build_cmd, start_cmd,
		port, domain, output_dir, env_vars, status, pid, started_at, created_at, updated_at,
		last_commit, last_commit_msg
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query,
		app.ID, app.Name, app.RepoURL, app.Branch, app.RootDir, app.ServiceType,
		app.BuildCmd, app.StartCmd, app.Port, app.Domain, app.OutputDir, string(envJSON),
		app.Status, app.PID, app.StartedAt, app.CreatedAt, app.UpdatedAt,
		app.LastCommit, app.LastCommitMsg,
	)
	return err
}

// UpdateApp updates an existing application.
func (s *Store) UpdateApp(app *App) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	envJSON, _ := json.Marshal(app.EnvVars)
	app.UpdatedAt = time.Now()

	query := `UPDATE apps SET
		name = ?, repo_url = ?, branch = ?, root_dir = ?, service_type = ?,
		build_cmd = ?, start_cmd = ?, port = ?, domain = ?, output_dir = ?,
		env_vars = ?, status = ?, pid = ?, started_at = ?, updated_at = ?,
		last_commit = ?, last_commit_msg = ?
		WHERE id = ?`

	_, err := s.db.Exec(query,
		app.Name, app.RepoURL, app.Branch, app.RootDir, app.ServiceType,
		app.BuildCmd, app.StartCmd, app.Port, app.Domain, app.OutputDir,
		string(envJSON), app.Status, app.PID, app.StartedAt, app.UpdatedAt,
		app.LastCommit, app.LastCommitMsg, app.ID,
	)
	return err
}

// DeleteApp deletes an app and its deployments.
func (s *Store) DeleteApp(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, _ = s.db.Exec(`DELETE FROM deployments WHERE app_id = ?`, id)
	_, err := s.db.Exec(`DELETE FROM apps WHERE id = ?`, id)
	return err
}

// CreateDeployment records a new deployment.
func (s *Store) CreateDeployment(d *Deployment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT INTO deployments (
		id, app_id, commit_hash, commit_msg, status, logs, started_at, ended_at, duration_sec
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query,
		d.ID, d.AppID, d.CommitHash, d.CommitMsg, d.Status, d.Logs,
		d.StartedAt, d.EndedAt, d.DurationSec,
	)
	return err
}

// UpdateDeployment updates a deployment record.
func (s *Store) UpdateDeployment(d *Deployment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `UPDATE deployments SET
		status = ?, logs = ?, ended_at = ?, duration_sec = ?
		WHERE id = ?`

	_, err := s.db.Exec(query, d.Status, d.Logs, d.EndedAt, d.DurationSec, d.ID)
	return err
}

// GetDeployments retrieves deployments for a given app.
func (s *Store) GetDeployments(appID string) ([]*Deployment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT id, app_id, commit_hash, commit_msg, status, started_at, ended_at, duration_sec
	          FROM deployments WHERE app_id = ? ORDER BY started_at DESC LIMIT 50`

	rows, err := s.db.Query(query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Deployment
	for rows.Next() {
		var d Deployment
		var endedAt sql.NullTime

		err := rows.Scan(
			&d.ID, &d.AppID, &d.CommitHash, &d.CommitMsg, &d.Status,
			&d.StartedAt, &endedAt, &d.DurationSec,
		)
		if err != nil {
			return nil, err
		}
		if endedAt.Valid {
			d.EndedAt = &endedAt.Time
		}
		list = append(list, &d)
	}

	return list, nil
}

// GetNextAvailablePort finds an unused port starting from 3001.
func (s *Store) GetNextAvailablePort() (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT port FROM apps WHERE port >= 3000 ORDER BY port ASC`
	rows, err := s.db.Query(query)
	if err != nil {
		return 3001, err
	}
	defer rows.Close()

	usedPorts := make(map[int]bool)
	for rows.Next() {
		var p int
		if err := rows.Scan(&p); err == nil && p > 0 {
			usedPorts[p] = true
		}
	}

	for candidate := 3001; candidate < 4000; candidate++ {
		if !usedPorts[candidate] {
			return candidate, nil
		}
	}

	return 4000, nil
}
