package supervisor

import (
	"sync"
	"time"
)

// LogLine represents a single output line from build or runtime execution.
type LogLine struct {
	Timestamp time.Time `json:"timestamp"`
	Stream    string    `json:"stream"` // "stdout", "stderr", "system"
	Content   string    `json:"content"`
}

// AppLogger manages in-memory log history and live subscribers for an application.
type AppLogger struct {
	mu          sync.RWMutex
	maxLines    int
	buffer      []LogLine
	subscribers map[chan LogLine]struct{}
}

// NewAppLogger creates an AppLogger with a maximum ring buffer capacity.
func NewAppLogger(maxLines int) *AppLogger {
	if maxLines <= 0 {
		maxLines = 2000
	}
	return &AppLogger{
		maxLines:    maxLines,
		buffer:      make([]LogLine, 0, maxLines),
		subscribers: make(map[chan LogLine]struct{}),
	}
}

// Append adds a new log line and broadcasts it to all active WebSocket subscribers.
func (l *AppLogger) Append(stream, content string) {
	entry := LogLine{
		Timestamp: time.Now(),
		Stream:    stream,
		Content:   content,
	}

	l.mu.Lock()
	if len(l.buffer) >= l.maxLines {
		l.buffer = l.buffer[1:]
	}
	l.buffer = append(l.buffer, entry)

	// Broadcast to subscribers
	for ch := range l.subscribers {
		select {
		case ch <- entry:
		default:
			// drop if subscriber channel is blocked to avoid slowing execution
		}
	}
	l.mu.Unlock()
}

// GetHistory returns a snapshot of buffered log lines.
func (l *AppLogger) GetHistory() []LogLine {
	l.mu.RLock()
	defer l.mu.RUnlock()

	history := make([]LogLine, len(l.buffer))
	copy(history, l.buffer)
	return history
}

// Clear wipes the buffer.
func (l *AppLogger) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.buffer = l.buffer[:0]
}

// Subscribe returns a channel receiving new log lines and an unsubscribe function.
func (l *AppLogger) Subscribe() (chan LogLine, func()) {
	l.mu.Lock()
	defer l.mu.Unlock()

	ch := make(chan LogLine, 200)
	l.subscribers[ch] = struct{}{}

	unsubscribe := func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		delete(l.subscribers, ch)
		close(ch)
	}

	return ch, unsubscribe
}
