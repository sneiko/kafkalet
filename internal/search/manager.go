package search

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"kafkalet/internal/profile"
	"kafkalet/internal/schema"
)

// Manager owns all active search sessions and handles their lifecycle.
type Manager struct {
	mu             sync.RWMutex
	sessions       map[string]*SearchSession
	brokerSessions map[string][]string // brokerID -> []sessionID
	ctx            context.Context
	emit           EmitFunc
}

// NewManager creates a Manager. ctx is the application-level context.
func NewManager(ctx context.Context, emit EmitFunc) *Manager {
	return &Manager{
		sessions:       make(map[string]*SearchSession),
		brokerSessions: make(map[string][]string),
		ctx:            ctx,
		emit:           emit,
	}
}

// StartSearch starts a new search session and returns the session ID.
func (m *Manager) StartSearch(b profile.Broker, password string, req SearchRequest, reg *schema.Registry) (string, error) {
	sessionID := uuid.NewString()
	s, err := newSearchSession(m.ctx, sessionID, b, password, req, reg, m.emit)
	if err != nil {
		return "", fmt.Errorf("start search: %w", err)
	}

	m.mu.Lock()
	m.sessions[sessionID] = s
	m.brokerSessions[b.ID] = append(m.brokerSessions[b.ID], sessionID)
	m.mu.Unlock()

	return sessionID, nil
}

// Stop cancels a search session and removes it from the registry.
func (m *Manager) Stop(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.sessions[sessionID]; ok {
		s.Stop()
		delete(m.sessions, sessionID)
	}
}

// StopBroker stops all search sessions for the given broker ID.
func (m *Manager) StopBroker(brokerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, sid := range m.brokerSessions[brokerID] {
		if s, ok := m.sessions[sid]; ok {
			s.Stop()
			delete(m.sessions, sid)
		}
	}
	delete(m.brokerSessions, brokerID)
}

// StopAll cancels all active search sessions.
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.sessions {
		s.Stop()
		delete(m.sessions, id)
	}
	m.brokerSessions = make(map[string][]string)
}
