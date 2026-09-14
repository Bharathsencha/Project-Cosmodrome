package api

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/database"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/git"
	"github.com/Bharathsencha/Project-Cosmodrome/internal/supervisor"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// SetupRouter sets up Chi router with API, WebSocket, and embedded static dashboard routes.
func SetupRouter(
	store *database.Store,
	gitEngine *git.Engine,
	supervisorMgr *supervisor.Manager,
	webFS fs.FS,
) http.Handler {
	r := chi.NewRouter()

	// Global Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	appHandler := NewAppHandler(store, gitEngine, supervisorMgr)

	// API Routes
	r.Route("/api", func(api chi.Router) {
		api.Get("/system", appHandler.GetSystemStats)

		api.Route("/apps", func(apps chi.Router) {
			apps.Get("/", appHandler.ListApps)
			apps.Post("/", appHandler.CreateApp)

			apps.Route("/{id}", func(app chi.Router) {
				app.Get("/", appHandler.GetApp)
				app.Put("/", appHandler.UpdateApp)
				app.Delete("/", appHandler.DeleteApp)

				app.Post("/deploy", appHandler.Deploy)
				app.Post("/restart", appHandler.Restart)
				app.Post("/stop", appHandler.Stop)
				app.Get("/deployments", appHandler.GetDeployments)
			})
		})
	})

	// WebSocket Live Logs
	r.Get("/ws/logs/{id}", HandleLogsWebSocket(supervisorMgr))

	// Embedded Dashboard static file server (with SPA fallback)
	if webFS != nil {
		fileServer := http.FileServer(http.FS(webFS))
		handler := func(w http.ResponseWriter, req *http.Request) {
			path := strings.TrimPrefix(req.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			// Check if file exists in webFS
			f, err := webFS.Open(path)
			if err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, req)
				return
			}

			// SPA Fallback: serve index.html
			indexFile, err := webFS.Open("index.html")
			if err == nil {
				_ = indexFile.Close()
				req.URL.Path = "/"
				fileServer.ServeHTTP(w, req)
				return
			}

			http.NotFound(w, req)
		}

		r.Get("/*", handler)
		r.Head("/*", handler)
	}

	return r
}
