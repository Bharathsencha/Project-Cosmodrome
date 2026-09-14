package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/database"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/git"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/supervisor"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// AppHandler provides HTTP endpoints for managing applications and deployments.
type AppHandler struct {
	store      *database.Store
	gitEngine  *git.Engine
	supervisor *supervisor.Manager
	runner     *supervisor.CommandRunner
}

// NewAppHandler creates a new AppHandler.
func NewAppHandler(
	store *database.Store,
	gitEngine *git.Engine,
	supervisorMgr *supervisor.Manager,
) *AppHandler {
	return &AppHandler{
		store:      store,
		gitEngine:  gitEngine,
		supervisor: supervisorMgr,
		runner:     supervisor.NewCommandRunner(),
	}
}

// GetSystemStats returns real-time CPU, RAM, Disk, and server uptime.
func (h *AppHandler) GetSystemStats(w http.ResponseWriter, r *http.Request) {
	apps, err := h.store.GetApps()
	total := 0
	active := 0
	if err == nil {
		total = len(apps)
		for _, a := range apps {
			if a.Status == database.StatusRunning {
				active++
			}
		}
	}

	stats := GetSystemStats(total, active)
	respondJSON(w, http.StatusOK, stats)
}

// ListApps returns all registered applications.
func (h *AppHandler) ListApps(w http.ResponseWriter, r *http.Request) {
	apps, err := h.store.GetApps()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if apps == nil {
		apps = []*database.App{}
	}
	respondJSON(w, http.StatusOK, apps)
}

// GetApp retrieves a single application by ID.
func (h *AppHandler) GetApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, err := h.store.GetApp(id)
	if err != nil || app == nil {
		respondError(w, http.StatusNotFound, "App not found")
		return
	}
	respondJSON(w, http.StatusOK, app)
}

// CreateAppRequest represents payload to create a new application.
type CreateAppRequest struct {
	Name        string            `json:"name"`
	RepoURL     string            `json:"repo_url"`
	Branch      string            `json:"branch"`
	RootDir     string            `json:"root_dir"`
	ServiceType database.ServiceType `json:"service_type"`
	BuildCmd    string            `json:"build_cmd"`
	StartCmd    string            `json:"start_cmd"`
	Domain      string            `json:"domain"`
	OutputDir   string            `json:"output_dir"`
	EnvVars     map[string]string `json:"env_vars"`
	AutoDeploy  bool              `json:"auto_deploy"`
}

// CreateApp registers a new application and optionally starts initial deploy.
func (h *AppHandler) CreateApp(w http.ResponseWriter, r *http.Request) {
	var req CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.RepoURL) == "" {
		respondError(w, http.StatusBadRequest, "Name and Git repository URL are required")
		return
	}

	if req.Branch == "" {
		req.Branch = "main"
	}
	if req.ServiceType == "" {
		req.ServiceType = database.TypeWebService
	}
	if req.OutputDir == "" {
		req.OutputDir = "dist"
	}
	if req.EnvVars == nil {
		req.EnvVars = make(map[string]string)
	}

	port, err := h.store.GetNextAvailablePort()
	if err != nil {
		port = 3001
	}

	app := &database.App{
		ID:          uuid.New().String()[:8],
		Name:        strings.TrimSpace(req.Name),
		RepoURL:     strings.TrimSpace(req.RepoURL),
		Branch:      strings.TrimSpace(req.Branch),
		RootDir:     strings.TrimSpace(req.RootDir),
		ServiceType: req.ServiceType,
		BuildCmd:    strings.TrimSpace(req.BuildCmd),
		StartCmd:    strings.TrimSpace(req.StartCmd),
		Port:        port,
		Domain:      strings.TrimSpace(req.Domain),
		OutputDir:   strings.TrimSpace(req.OutputDir),
		EnvVars:     req.EnvVars,
		Status:      database.StatusIdle,
	}

	if err := h.store.CreateApp(app); err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create app: %v", err))
		return
	}

	if req.AutoDeploy {
		go h.executeDeploy(app)
	}

	respondJSON(w, http.StatusCreated, app)
}

// UpdateApp modifies configuration of an existing application.
func (h *AppHandler) UpdateApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, err := h.store.GetApp(id)
	if err != nil || app == nil {
		respondError(w, http.StatusNotFound, "App not found")
		return
	}

	var req CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name != "" {
		app.Name = req.Name
	}
	if req.RepoURL != "" {
		app.RepoURL = req.RepoURL
	}
	if req.Branch != "" {
		app.Branch = req.Branch
	}
	app.RootDir = req.RootDir
	if req.BuildCmd != "" {
		app.BuildCmd = req.BuildCmd
	}
	app.StartCmd = req.StartCmd
	app.Domain = req.Domain
	if req.OutputDir != "" {
		app.OutputDir = req.OutputDir
	}
	if req.EnvVars != nil {
		app.EnvVars = req.EnvVars
	}

	if err := h.store.UpdateApp(app); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, app)
}

// DeleteApp stops running process and removes app from disk and DB.
func (h *AppHandler) DeleteApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h.supervisor.StopApp(id)
	_ = h.gitEngine.DeleteAppDir(id)

	if err := h.store.DeleteApp(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "App deleted successfully"})
}

// Deploy triggers a build and restart cycle.
func (h *AppHandler) Deploy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, err := h.store.GetApp(id)
	if err != nil || app == nil {
		respondError(w, http.StatusNotFound, "App not found")
		return
	}

	go h.executeDeploy(app)

	respondJSON(w, http.StatusAccepted, map[string]string{"message": "Deployment initiated"})
}

// Restart restarts a running application.
func (h *AppHandler) Restart(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, err := h.store.GetApp(id)
	if err != nil || app == nil {
		respondError(w, http.StatusNotFound, "App not found")
		return
	}

	if app.ServiceType != database.TypeWebService {
		respondError(w, http.StatusBadRequest, "Static sites do not have a persistent process to restart")
		return
	}

	appDir := filepath.Join(h.gitEngine.GetAppDir(app.ID), app.RootDir)
	if err := h.supervisor.StartApp(app, appDir); err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to restart: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Service restarted"})
}

// Stop terminates an application's process.
func (h *AppHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, err := h.store.GetApp(id)
	if err != nil || app == nil {
		respondError(w, http.StatusNotFound, "App not found")
		return
	}

	h.supervisor.StopApp(app.ID)
	app.Status = database.StatusStopped
	app.PID = 0
	_ = h.store.UpdateApp(app)

	respondJSON(w, http.StatusOK, map[string]string{"message": "Service stopped"})
}

// GetDeployments lists previous deployments for an app.
func (h *AppHandler) GetDeployments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	deployments, err := h.store.GetDeployments(id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if deployments == nil {
		deployments = []*database.Deployment{}
	}
	respondJSON(w, http.StatusOK, deployments)
}

func (h *AppHandler) executeDeploy(app *database.App) {
	logger := h.supervisor.GetLogger(app.ID)
	logger.Append("system", "==================================================")
	logger.Append("system", fmt.Sprintf("==> Deployment triggered for [%s]", app.Name))
	logger.Append("system", "==================================================")

	deployID := uuid.New().String()[:8]
	start := time.Now()

	deployment := &database.Deployment{
		ID:        deployID,
		AppID:     app.ID,
		Status:    "building",
		StartedAt: start,
	}
	_ = h.store.CreateDeployment(deployment)

	app.Status = database.StatusBuilding
	_ = h.store.UpdateApp(app)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	// 1. Git Clone / Pull
	commit, appDir, err := h.gitEngine.SyncRepo(ctx, app.ID, app.RepoURL, app.Branch, logger)
	if err != nil {
		h.markDeployFailed(app, deployment, logger, fmt.Sprintf("Git sync failed: %v", err), start)
		return
	}

	if commit != nil {
		deployment.CommitHash = commit.Hash
		deployment.CommitMsg = commit.Message
		app.LastCommit = commit.Hash
		app.LastCommitMsg = commit.Message
	}

	workDir := filepath.Join(appDir, app.RootDir)

	// 2. Build Execution
	if strings.TrimSpace(app.BuildCmd) != "" {
		if err := h.runner.ExecuteRun(ctx, workDir, app.BuildCmd, app.EnvVars, logger); err != nil {
			h.markDeployFailed(app, deployment, logger, fmt.Sprintf("Build command failed: %v", err), start)
			return
		}
	}

	// 3. Process Execution / Activation
	if app.ServiceType == database.TypeWebService {
		if strings.TrimSpace(app.StartCmd) == "" {
			h.markDeployFailed(app, deployment, logger, "Start command is required for web services", start)
			return
		}

		if err := h.supervisor.StartApp(app, workDir); err != nil {
			h.markDeployFailed(app, deployment, logger, fmt.Sprintf("Failed to start process: %v", err), start)
			return
		}
	} else {
		// Static Site: mark running
		now := time.Now()
		app.Status = database.StatusRunning
		app.StartedAt = &now
		_ = h.store.UpdateApp(app)
		logger.Append("system", fmt.Sprintf("==> Static site ready! Serving from directory '%s'", app.OutputDir))
	}

	// Mark deploy success
	now := time.Now()
	deployment.Status = "success"
	deployment.EndedAt = &now
	deployment.DurationSec = int64(now.Sub(start).Seconds())
	_ = h.store.UpdateDeployment(deployment)

	logger.Append("system", fmt.Sprintf("==> Deployment completed successfully in %ds!", deployment.DurationSec))
}

func (h *AppHandler) markDeployFailed(
	app *database.App,
	d *database.Deployment,
	logger *supervisor.AppLogger,
	reason string,
	start time.Time,
) {
	now := time.Now()
	d.Status = "failed"
	d.EndedAt = &now
	d.DurationSec = int64(now.Sub(start).Seconds())
	_ = h.store.UpdateDeployment(d)

	app.Status = database.StatusFailed
	_ = h.store.UpdateApp(app)

	logger.Append("system", fmt.Sprintf("==> DEPLOYMENT FAILED: %s", reason))
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
