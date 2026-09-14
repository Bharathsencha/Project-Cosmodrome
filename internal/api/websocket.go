package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Bharathsencha/Project-Cosmodrome/internal/supervisor"
	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin WebSocket for local dev & tunnels
	},
}

// HandleLogsWebSocket handles live streaming of logs for a specific application.
func HandleLogsWebSocket(supervisorMgr *supervisor.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appID := chi.URLParam(r, "id")
		if appID == "" {
			http.Error(w, "App ID required", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		logger := supervisorMgr.GetLogger(appID)

		// 1. Send existing history first
		history := logger.GetHistory()
		for _, line := range history {
			data, _ := json.Marshal(line)
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		}

		// 2. Subscribe to live stream
		ch, unsubscribe := logger.Subscribe()
		defer unsubscribe()

		// Read pump to detect client close
		clientClosed := make(chan struct{})
		go func() {
			defer close(clientClosed)
			for {
				if _, _, err := conn.NextReader(); err != nil {
					return
				}
			}
		}()

		// Write pump
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-clientClosed:
				return
			case <-ticker.C:
				// Send ping to keep connection alive through Cloudflare Tunnels
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case line, ok := <-ch:
				if !ok {
					return
				}
				data, _ := json.Marshal(line)
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					return
				}
			}
		}
	}
}
