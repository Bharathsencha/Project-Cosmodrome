package supervisor

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
)

// CommandRunner executes shell commands in a working directory and streams logs.
type CommandRunner struct{}

// NewCommandRunner creates a new CommandRunner instance.
func NewCommandRunner() *CommandRunner {
	return &CommandRunner{}
}

// ExecuteRun runs a command string (e.g. "npm install && npm run build") using sh or bash.
func (r *CommandRunner) ExecuteRun(
	ctx context.Context,
	workDir string,
	commandStr string,
	envVars map[string]string,
	logger *AppLogger,
) error {
	if strings.TrimSpace(commandStr) == "" {
		return nil
	}

	logger.Append("system", fmt.Sprintf("==> Executing: %s (in %s)", commandStr, workDir))

	cmd := exec.CommandContext(ctx, "bash", "-c", commandStr)
	cmd.Dir = workDir

	// Inherit system PATH and environment, overlay app env vars
	env := os.Environ()
	for k, v := range envVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Env = env

	// Set process group so any child processes get cancelled properly on timeout
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to open stdout pipe: %w", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to open stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		logger.Append("system", fmt.Sprintf("Error starting command: %v", err))
		return err
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Stream stdout
	go func() {
		defer wg.Done()
		streamReader(stdoutPipe, "stdout", logger)
	}()

	// Stream stderr
	go func() {
		defer wg.Done()
		streamReader(stderrPipe, "stderr", logger)
	}()

	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		logger.Append("system", fmt.Sprintf("Command failed with error: %v", err))
		return err
	}

	logger.Append("system", "==> Command completed successfully.")
	return nil
}

func streamReader(r io.Reader, stream string, logger *AppLogger) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		logger.Append(stream, scanner.Text())
	}
}
