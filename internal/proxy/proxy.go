package proxy

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/database"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/git"
)

// Router handles domain-based routing, reverse proxying, and static site serving.
type Router struct {
	store      *database.Store
	gitEngine  *git.Engine
	mu         sync.RWMutex
	proxies    map[int]*httputil.ReverseProxy
	dashboard  http.Handler
}

// NewRouter creates a new domain routing proxy.
func NewRouter(store *database.Store, gitEngine *git.Engine, dashboardHandler http.Handler) *Router {
	return &Router{
		store:      store,
		gitEngine:  gitEngine,
		proxies:    make(map[int]*httputil.ReverseProxy),
		dashboard:  dashboardHandler,
	}
}

// ServeHTTP inspects incoming Host header to route either to an app or to the Cosmodrome dashboard.
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	host := req.Host
	// Strip port if present in host (e.g., "api.example.com:8080" -> "api.example.com")
	if colon := strings.IndexByte(host, ':'); colon != -1 {
		host = host[:colon]
	}

	// Reserved or dashboard hostnames
	if host == "localhost" || host == "127.0.0.1" || strings.HasPrefix(host, "dashboard.") {
		r.dashboard.ServeHTTP(w, req)
		return
	}

	// Look up app by domain
	app, err := r.store.GetAppByDomain(host)
	if err != nil || app == nil {
		// If no custom domain matches, route to the dashboard
		r.dashboard.ServeHTTP(w, req)
		return
	}

	// Route based on app type
	switch app.ServiceType {
	case database.TypeWebService:
		if app.Port <= 0 || app.Status != database.StatusRunning {
			http.Error(w, fmt.Sprintf("Service '%s' is not running (Status: %s)", app.Name, app.Status), http.StatusBadGateway)
			return
		}
		r.proxyToBackend(w, req, app.Port)

	case database.TypeStaticSite:
		r.serveStaticSite(w, req, app)

	default:
		http.Error(w, "Unknown service type", http.StatusInternalServerError)
	}
}

func (r *Router) proxyToBackend(w http.ResponseWriter, req *http.Request, port int) {
	r.mu.RLock()
	proxy, exists := r.proxies[port]
	r.mu.RUnlock()

	if !exists {
		targetURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", port))
		proxy = httputil.NewSingleHostReverseProxy(targetURL)
		
		// Custom error handler for clean error reporting
		proxy.ErrorHandler = func(rw http.ResponseWriter, r *http.Request, err error) {
			http.Error(rw, fmt.Sprintf("Service unavailable on port %d: %v", port, err), http.StatusBadGateway)
		}

		r.mu.Lock()
		r.proxies[port] = proxy
		r.mu.Unlock()
	}

	proxy.ServeHTTP(w, req)
}

func (r *Router) serveStaticSite(w http.ResponseWriter, req *http.Request, app *database.App) {
	appDir := r.gitEngine.GetAppDir(app.ID)
	outDir := app.OutputDir
	if outDir == "" {
		outDir = "dist"
	}

	fullStaticDir := filepath.Join(appDir, app.RootDir, outDir)

	requestedFile := filepath.Join(fullStaticDir, filepath.Clean(req.URL.Path))
	info, err := os.Stat(requestedFile)

	// If file exists and is not a directory, serve it directly
	if err == nil && !info.IsDir() {
		http.ServeFile(w, req, requestedFile)
		return
	}

	// SPA fallback: serve index.html for client-side routing (React/Svelte Router)
	indexPath := filepath.Join(fullStaticDir, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, req, indexPath)
		return
	}

	// If neither exists, serve directory contents or 404
	http.FileServer(http.Dir(fullStaticDir)).ServeHTTP(w, req)
}
