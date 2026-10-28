package httpapi

import (
	"net/http"
	"sync"
	"time"

	"github.com/aliAljaffer/grooszy/internal/auth"
)

// providerCallsPerMinute caps the endpoints that spend money at a provider.
// The owner is the only caller, so one key covers the deployment.
const providerCallsPerMinute = 10

type window struct {
	start time.Time
	count int
}

type limiter struct {
	mu      sync.Mutex
	entries map[string]window
	now     func() time.Time
	limit   int
	window  time.Duration
}

func newLimiter(limit int, per time.Duration) *limiter {
	return &limiter{entries: make(map[string]window), now: time.Now, limit: limit, window: per}
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	current, seen := l.entries[key]
	if !seen || now.Sub(current.start) >= l.window {
		l.entries[key] = window{start: now, count: 1}
		return true
	}
	if current.count >= l.limit {
		return false
	}
	current.count++
	l.entries[key] = current
	return true
}

func (s *Server) protectSpend(h func(http.ResponseWriter, *http.Request, auth.Identity)) http.Handler {
	return s.guard(s.spend, h)
}
