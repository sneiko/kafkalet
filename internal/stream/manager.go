package stream

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/profile"
	"kafkalet/internal/schema"
)

// EmitFunc is a goroutine-safe function that sends an event to the frontend.
type EmitFunc func(eventName string, data any)

// ObserverOpts configures a new observer session.
type ObserverOpts struct {
	// StartOffset: "latest" (default) | "earliest"
	// Ignored when PartitionOffsets is non-nil.
	StartOffset string
	// PartitionOffsets, when non-nil, seeks each partition to an exact offset.
	// Supersedes StartOffset.
	PartitionOffsets map[int32]int64
	// Registry, when non-nil, decodes Avro messages using the Confluent wire format.
	Registry *schema.Registry
}

// ConsumerOpts configures a new consumer group session.
type ConsumerOpts struct {
	GroupID string
	// StartOffset: "latest" (default) | "earliest"
	// Applied only when the group has no committed offsets yet.
	StartOffset string
	// Registry, when non-nil, decodes Avro messages using the Confluent wire format.
	Registry *schema.Registry
}

// Manager owns all active sessions and handles their lifecycle.
type Manager struct {
	mu             sync.RWMutex
	sessions       map[string]Session
	brokerSessions map[string][]string // brokerID -> []sessionID
	ctx            context.Context
	emit           EmitFunc
}

// NewManager creates a Manager. ctx is the application-level context.
// emit wraps runtime.EventsEmit — must be goroutine-safe.
func NewManager(ctx context.Context, emit EmitFunc) *Manager {
	return &Manager{
		sessions:       make(map[string]Session),
		brokerSessions: make(map[string][]string),
		ctx:            ctx,
		emit:           emit,
	}
}

// StartObserver starts a new observer session and returns the session ID.
func (m *Manager) StartObserver(b profile.Broker, password, topic string, opts ObserverOpts) (string, error) {
	var consumeOpts []kgo.Opt
	if len(opts.PartitionOffsets) > 0 {
		partitions := map[string]map[int32]kgo.Offset{topic: {}}
		for p, off := range opts.PartitionOffsets {
			partitions[topic][p] = kgo.NewOffset().At(off)
		}
		consumeOpts = []kgo.Opt{kgo.ConsumePartitions(partitions)}
	} else {
		startOffset := kgo.NewOffset().AtEnd()
		if opts.StartOffset == "earliest" {
			startOffset = kgo.NewOffset().AtStart()
		}
		consumeOpts = []kgo.Opt{
			kgo.ConsumeTopics(topic),
			kgo.ConsumeResetOffset(startOffset),
		}
	}

	sessionID := uuid.NewString()
	obs, err := newObserver(m.ctx, sessionID, b, password, consumeOpts,
		buildDecode(opts.Registry),
		func(msg KafkaMessage) { m.emit("stream:"+sessionID, msg) },
	)
	if err != nil {
		return "", fmt.Errorf("start observer: %w", err)
	}

	m.mu.Lock()
	m.sessions[sessionID] = obs
	m.brokerSessions[b.ID] = append(m.brokerSessions[b.ID], sessionID)
	m.mu.Unlock()

	return sessionID, nil
}

// StartConsumer starts a new consumer group session and returns the session ID.
func (m *Manager) StartConsumer(b profile.Broker, password, topic string, opts ConsumerOpts) (string, error) {
	resetOffset := kgo.NewOffset().AtEnd()
	if opts.StartOffset == "earliest" {
		resetOffset = kgo.NewOffset().AtStart()
	}

	sessionID := uuid.NewString()
	cons, err := newConsumer(m.ctx, sessionID, b, password, topic, opts.GroupID, resetOffset,
		buildDecode(opts.Registry),
		func(msg KafkaMessage) { m.emit("stream:"+sessionID, msg) },
	)
	if err != nil {
		return "", fmt.Errorf("start consumer: %w", err)
	}

	m.mu.Lock()
	m.sessions[sessionID] = cons
	m.brokerSessions[b.ID] = append(m.brokerSessions[b.ID], sessionID)
	m.mu.Unlock()

	return sessionID, nil
}

// buildDecode returns a value-decode function backed by Schema Registry (if reg != nil).
// When reg is nil the function falls back to safeString (UTF-8 or base64).
func buildDecode(reg *schema.Registry) func([]byte) string {
	if reg == nil {
		return safeString
	}
	return func(raw []byte) string {
		decoded, ok, err := schema.TryDecodeAvro(reg, raw)
		if ok {
			if err != nil {
				return fmt.Sprintf("[avro decode error: %v]", err)
			}
			return decoded
		}
		return safeString(raw)
	}
}

// CommitSession commits all marked-but-not-yet-committed offsets for a consumer session.
// Returns an error if the session is not found or is not a consumer session.
func (m *Manager) CommitSession(ctx context.Context, sessionID string) error {
	m.mu.RLock()
	s, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	cs, ok := s.(*ConsumerSession)
	if !ok {
		return fmt.Errorf("session %q is not a consumer session", sessionID)
	}
	return cs.Commit(ctx)
}

// Stop cancels a session and removes it from the registry.
func (m *Manager) Stop(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.sessions[sessionID]; ok {
		s.Stop()
		delete(m.sessions, sessionID)
	}
}

// StopBroker stops all sessions for the given broker ID.
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

// StopAll cancels all active sessions (called on profile switch).
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.sessions {
		s.Stop()
		delete(m.sessions, id)
	}
	m.brokerSessions = make(map[string][]string)
}
