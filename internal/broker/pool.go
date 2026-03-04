package broker

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/profile"
)

// ClientFactory creates a franz-go client from broker config and password.
type ClientFactory func(b profile.Broker, password string) (*kgo.Client, error)

type poolEntry struct {
	client   *kgo.Client
	lastUsed time.Time
}

// Pool maintains a cache of franz-go clients keyed by "brokerID:credentialID".
// Idle clients are evicted by a background reaper goroutine.
type Pool struct {
	mu      sync.Mutex
	entries map[string]*poolEntry
	factory ClientFactory
	ttl     time.Duration
	cancel  context.CancelFunc
}

// NewPool creates a Pool and starts the background reaper.
func NewPool(ttl time.Duration, factory ClientFactory) *Pool {
	ctx, cancel := context.WithCancel(context.Background())
	p := &Pool{
		entries: make(map[string]*poolEntry),
		factory: factory,
		ttl:     ttl,
		cancel:  cancel,
	}
	go p.reaper(ctx)
	return p
}

func poolKey(brokerID, credID string) string {
	return brokerID + ":" + credID
}

// Get returns a cached client or creates a new one via the factory.
func (p *Pool) Get(b profile.Broker, credID, password string) (*kgo.Client, error) {
	key := poolKey(b.ID, credID)

	p.mu.Lock()
	if e, ok := p.entries[key]; ok {
		e.lastUsed = time.Now()
		p.mu.Unlock()
		return e.client, nil
	}
	p.mu.Unlock()

	client, err := p.factory(b, password)
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	// Double-check: another goroutine may have created the same entry.
	if e, ok := p.entries[key]; ok {
		p.mu.Unlock()
		client.Close()
		return e.client, nil
	}
	p.entries[key] = &poolEntry{client: client, lastUsed: time.Now()}
	p.mu.Unlock()

	return client, nil
}

// EvictBroker closes and removes all entries whose key starts with "brokerID:".
func (p *Pool) EvictBroker(brokerID string) {
	prefix := brokerID + ":"
	p.mu.Lock()
	defer p.mu.Unlock()
	for key, e := range p.entries {
		if strings.HasPrefix(key, prefix) {
			e.client.Close()
			delete(p.entries, key)
		}
	}
}

// CloseAll closes every cached client (e.g. on profile switch).
func (p *Pool) CloseAll() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for key, e := range p.entries {
		e.client.Close()
		delete(p.entries, key)
	}
}

// Close stops the reaper and closes all cached clients.
func (p *Pool) Close() {
	p.cancel()
	p.CloseAll()
}

func (p *Pool) reaper(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			p.mu.Lock()
			for key, e := range p.entries {
				if now.Sub(e.lastUsed) > p.ttl {
					e.client.Close()
					delete(p.entries, key)
				}
			}
			p.mu.Unlock()
		}
	}
}
