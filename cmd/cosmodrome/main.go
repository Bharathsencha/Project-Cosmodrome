package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/api"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/database"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/git"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/proxy"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/supervisor"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/tunnel"
	"github.com/Bharathsencha/Project-Cosmodrome/web"
)

func main() {
	port := flag.Int("port", 8080, "Port for Cosmodrome server and reverse proxy")
	dbPath := flag.String("db", "data/cosmodrome.db", "Path to SQLite database file")
	workspacesDir := flag.String("workspaces", "data/workspaces", "Path to git workspaces directory")
	flag.Parse()

	printBanner(*port)

	// 1. Initialize SQLite Database
	store, err := database.InitDB(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Close()
	log.Printf("[Cosmodrome] Database initialized at %s", *dbPath)

	// 2. Initialize Git Engine
	gitEngine, err := git.NewEngine(*workspacesDir)
	if err != nil {
		log.Fatalf("Failed to initialize git engine: %v", err)
	}
	log.Printf("[Cosmodrome] Git workspaces initialized at %s", *workspacesDir)

	// 3. Initialize Process Supervisor
	supervisorMgr := supervisor.NewManager(store)

	// 4. Load Embedded Dashboard Assets
	webFS, err := web.GetFS()
	if err != nil {
		log.Printf("[Cosmodrome] Warning: Failed to load embedded frontend assets: %v", err)
	}

	// 5. Setup Chi API & Dashboard Router
	apiRouter := api.SetupRouter(store, gitEngine, supervisorMgr, webFS)

	// 6. Setup Reverse Proxy (routes domains -> app ports or static sites, default -> dashboard)
	rootHandler := proxy.NewRouter(store, gitEngine, apiRouter)

	// 7. Check Cloudflare Tunnel
	cfInstalled := tunnel.CheckCloudflaredInstalled()
	if cfInstalled {
		log.Printf("[Cosmodrome] ✓ Cloudflare Tunnel (cloudflared) detected on host")
	} else {
		log.Printf("[Cosmodrome] Note: cloudflared not found in PATH (optional for local use, recommended for public access)")
	}

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      rootHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in background
	go func() {
		log.Printf("[Cosmodrome] Server listening on http://0.0.0.0:%d", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Ignore SIGHUP so daemon stays alive even when subshell/terminal detaches
	signal.Ignore(syscall.SIGHUP)

	// Wait for termination signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("[Cosmodrome] Received signal %v, shutting down gracefully...\n", sig)

	// Graceful shutdown with 10s timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[Cosmodrome] Server shutdown error: %v", err)
	}

	// Stop all active processes
	apps, err := store.GetApps()
	if err == nil {
		for _, a := range apps {
			if a.Status == database.StatusRunning {
				supervisorMgr.StopApp(a.ID)
			}
		}
	}

	log.Println("[Cosmodrome] Stopped. Goodbye!")
}

func printBanner(port int) {
	fmt.Println(`
   ______                                __                          
  / ____/___  _________ ___  ____  ____/ /________  ____ ___  ___    
 / /   / __ \/ ___/ __ ` + "`" + `__ \/ __ \/ __  / ___/ __ \/ __ ` + "`" + `__ \/ _ \   
/ /___/ /_/ (__  ) / / / / / /_/ / /_/ / /  / /_/ / / / / / /  __/   
\____/\____/____/_/ /_/ /_/\____/\__,_/_/   \____/_/ /_/ /_/\___/    
                                                                     
   >> Self-Hosted PaaS Engine for Linux servers <<
`)
	stats := api.GetSystemStats(0, 0)
	fmt.Printf("   Hardware : %d CPU Cores | %d GB Total RAM\n", stats.CPUCores, stats.MemTotalMB/1024)
	fmt.Printf("   Dashboard: http://localhost:%d\n", port)
	fmt.Printf("   API Base : http://localhost:%d/api\n", port)
	fmt.Println("   Status   : Ready to deploy Node.js, Go, React, & Svelte")
	fmt.Println("-------------------------------------------------------------------")
}
