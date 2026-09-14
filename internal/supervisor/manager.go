package supervisor

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/database"
)

type runningProcess struct {
	appID     string
	cmd       *exec.Cmd
	pgid      int
	pid       int
	startedAt time.Time
	stopChan  chan struct{}
}

// Manager supervises all background running services.
type Manager struct {
	mu        sync.RWMutex
	processes map[string]*runningProcess
	loggers   map[string]*AppLogger
	store     *database.Store
}

// NewManager creates a new process supervisor manager.
func NewManager(store *database.Store) *Manager {
	return &Manager{
		processes: make(map[string]*runningProcess),
		loggers:   make(map[string]*AppLogger),
		store:     store,
	}
}

// GetLogger returns or creates an AppLogger for the given app ID.
func (m *Manager) GetLogger(appID string) *AppLogger {
	m.mu.Lock()
	defer m.mu.Unlock()

	if l, exists := m.loggers[appID]; exists {
		return l
	}
	l := NewAppLogger(2000)
	m.loggers[appID] = l
	return l
}

// IsRunning checks if an app process is actively running.
func (m *Manager) IsRunning(appID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	p, exists := m.processes[appID]
	if !exists || p.cmd == nil || p.cmd.Process == nil {
		return false
	}
	// Check if process is still alive via signal 0
	return p.cmd.Process.Signal(syscall.Signal(0)) == nil
}

// StartApp starts a long-running web service process.
func (m *Manager) StartApp(app *database.App, workDir string) error {
	m.StopApp(app.ID) // ensure any previous instance is terminated

	logger := m.GetLogger(app.ID)
	logger.Append("system", fmt.Sprintf("==> Starting service [%s] on port %d...", app.Name, app.Port))

	cmd := exec.Command("bash", "-c", app.StartCmd)
	cmd.Dir = workDir

	// Prepare environment variables
	env := os.Environ()
	// Set PORT for Node/Go apps automatically
	env = append(env, fmt.Sprintf("PORT=%d", app.Port))
	for k, v := range app.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Env = env

	// Set process group so we can kill the entire process tree cleanly
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		logger.Append("system", fmt.Sprintf("Error starting process: %v", err))
		return err
	}

	pid := cmd.Process.Pid
	pgid, err := syscall.Getpgid(pid)
	if err != nil {
		pgid = pid
	}

	now := time.Now()
	rp := &runningProcess{
		appID:     app.ID,
		cmd:       cmd,
		pgid:      pgid,
		pid:       pid,
		startedAt: now,
		stopChan:  make(chan struct{}),
	}

	m.mu.Lock()
	m.processes[app.ID] = rp
	m.mu.Unlock()

	// Update DB record
	app.Status = database.StatusRunning
	app.PID = pid
	app.StartedAt = &now
	_ = m.store.UpdateApp(app)

	logger.Append("system", fmt.Sprintf("==> Service [%s] started with PID %d (PGID %d)", app.Name, pid, pgid))

	// Stream stdout & stderr in background goroutines
	go m.streamProcessOutput(stdoutPipe, "stdout", logger)
	go m.streamProcessOutput(stderrPipe, "stderr", logger)

	// Wait for exit in background
	go m.monitorProcess(rp, app)

	return nil
}

func (m *Manager) streamProcessOutput(r io.Reader, stream string, logger *AppLogger) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		logger.Append(stream, scanner.Text())
	}
}

func (m *Manager) monitorProcess(rp *runningProcess, app *database.App) {
	err := rp.cmd.Wait()

	select {
	case <-rp.stopChan:
		// Explicitly stopped by user, do not auto-restart
		return
	default:
	}

	logger := m.GetLogger(rp.appID)
	logger.Append("system", fmt.Sprintf("==> Process exited with code/error: %v", err))

	m.mu.Lock()
	delete(m.processes, rp.appID)
	m.mu.Unlock()

	app.Status = database.StatusFailed
	app.PID = 0
	_ = m.store.UpdateApp(app)
}

// StopApp terminates a running service and its child process group.
func (m *Manager) StopApp(appID string) {
	m.mu.Lock()
	rp, exists := m.processes[appID]
	if !exists {
		m.mu.Unlock()
		return
	}
	delete(m.processes, appID)
	close(rp.stopChan)
	m.mu.Unlock()

	logger := m.GetLogger(appID)
	logger.Append("system", fmt.Sprintf("==> Stopping service (PID %d, PGID %d)...", rp.pid, rp.pgid))

	// Kill entire process group using negative PGID
	_ = syscall.Kill(-rp.pgid, syscall.SIGTERM)

	// Give it a grace period to terminate cleanly
	done := make(chan struct{})
	go func() {
		if rp.cmd.Process != nil {
			_, _ = rp.cmd.Process.Wait()
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		_ = syscall.Kill(-rp.pgid, syscall.SIGKILL)
	}

	logger.Append("system", "==> Service stopped.")
}
