package git

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/supervisor"
)

// Engine handles git clone, fetch, checkout, and commit inspection.
type Engine struct {
	baseDir string
}

// NewEngine creates a new git engine with a base workspace path.
func NewEngine(baseDir string) (*Engine, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create git base directory: %w", err)
	}
	return &Engine{baseDir: baseDir}, nil
}

// GetAppDir returns the directory path on disk for a given app.
func (e *Engine) GetAppDir(appID string) string {
	return filepath.Join(e.baseDir, appID)
}

// CommitInfo holds details about the latest commit.
type CommitInfo struct {
	Hash    string
	Message string
	Author  string
}

// SyncRepo clones or pulls the latest code from the specified branch.
func (e *Engine) SyncRepo(
	ctx context.Context,
	appID string,
	repoURL string,
	branch string,
	logger *supervisor.AppLogger,
) (*CommitInfo, string, error) {
	appDir := e.GetAppDir(appID)

	if branch == "" {
		branch = "main"
	}

	gitDir := filepath.Join(appDir, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		// Fresh clone
		logger.Append("system", fmt.Sprintf("==> Cloning %s (branch: %s)...", repoURL, branch))
		_ = os.RemoveAll(appDir)

		cmd := exec.CommandContext(ctx, "git", "clone", "--depth", "1", "-b", branch, repoURL, appDir)
		output, err := cmd.CombinedOutput()
		if len(output) > 0 {
			logger.Append("system", string(output))
		}
		if err != nil {
			return nil, "", fmt.Errorf("git clone failed: %w", err)
		}
	} else {
		// Existing repo: fetch and pull
		logger.Append("system", fmt.Sprintf("==> Pulling latest changes from %s...", branch))

		cmdFetch := exec.CommandContext(ctx, "git", "fetch", "origin", branch)
		cmdFetch.Dir = appDir
		_ = cmdFetch.Run()

		cmdCheckout := exec.CommandContext(ctx, "git", "checkout", branch)
		cmdCheckout.Dir = appDir
		_ = cmdCheckout.Run()

		cmdPull := exec.CommandContext(ctx, "git", "pull", "origin", branch)
		cmdPull.Dir = appDir
		output, err := cmdPull.CombinedOutput()
		if len(output) > 0 {
			logger.Append("system", string(output))
		}
		if err != nil {
			return nil, "", fmt.Errorf("git pull failed: %w", err)
		}
	}

	// Fetch commit info
	info, err := e.GetLatestCommit(appDir)
	if err != nil {
		return nil, appDir, nil
	}

	logger.Append("system", fmt.Sprintf("==> Head commit: [%s] %s", info.Hash[:min(7, len(info.Hash))], info.Message))
	return info, appDir, nil
}

// GetLatestCommit retrieves HEAD commit info.
func (e *Engine) GetLatestCommit(dir string) (*CommitInfo, error) {
	cmd := exec.Command("git", "log", "-1", "--format=%H%x1f%s%x1f%an")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	parts := strings.Split(strings.TrimSpace(string(out)), "\x1f")
	if len(parts) < 3 {
		return &CommitInfo{Hash: strings.TrimSpace(string(out))}, nil
	}

	return &CommitInfo{
		Hash:    parts[0],
		Message: parts[1],
		Author:  parts[2],
	}, nil
}

// DeleteAppDir removes the workspace directory from disk.
func (e *Engine) DeleteAppDir(appID string) error {
	return os.RemoveAll(e.GetAppDir(appID))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
