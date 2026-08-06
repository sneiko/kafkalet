package stream

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/broker"
	"kafkalet/internal/profile"
)

// ObserverSession reads a topic without joining a consumer group.
// No offsets are committed; the broker has no record of this client reading.
type ObserverSession struct {
	id         string
	client     *kgo.Client
	cancel     context.CancelFunc
	paused     bool
	pauseCh    chan struct{}
	resumeCh   chan struct{}
	pauseMu    sync.Mutex
}

func (s *ObserverSession) ID() string { return s.id }

func (s *ObserverSession) Stop() { s.cancel() }

func (s *ObserverSession) Pause() {
	s.pauseMu.Lock()
	defer s.pauseMu.Unlock()
	if !s.paused {
		s.paused = true
		s.pauseCh = make(chan struct{})
	}
}

func (s *ObserverSession) Resume() {
	s.pauseMu.Lock()
	defer s.pauseMu.Unlock()
	if s.paused {
		s.paused = false
		close(s.pauseCh)
		s.pauseCh = nil
	}
}

func (s *ObserverSession) IsPaused() bool {
	s.pauseMu.Lock()
	defer s.pauseMu.Unlock()
	return s.paused
}

// newObserver creates an ObserverSession and starts the poll goroutine.
// consumeOpts must include exactly one of kgo.ConsumeTopics or kgo.ConsumePartitions.
// decode converts raw record value bytes to a display string (e.g. Avro → JSON).
// decodeKey converts raw key bytes to (display, decoded) strings.
// emit is called for each received message and must be goroutine-safe.
func newObserver(
	appCtx context.Context,
	sessionID string,
	b profile.Broker,
	password string,
	consumeOpts []kgo.Opt,
	decode func([]byte) string,
	decodeKey func([]byte) (string, string),
	emit func(KafkaMessage),
) (*ObserverSession, error) {
	client, err := broker.NewClient(b, password, consumeOpts...)
	if err != nil {
		return nil, fmt.Errorf("observer %s: %w", sessionID, err)
	}

	sessCtx, cancel := context.WithCancel(appCtx)
	s := &ObserverSession{
		id:       sessionID,
		client:   client,
		cancel:   cancel,
		pauseCh:  make(chan struct{}),
	}

	go s.pollLoop(sessCtx, decode, decodeKey, emit)
	return s, nil
}

func (s *ObserverSession) pollLoop(ctx context.Context, decode func([]byte) string, decodeKey func([]byte) (string, string), emit func(KafkaMessage)) {
	defer s.client.Close()

	for {
		s.pauseMu.Lock()
		paused := s.paused
		pauseCh := s.pauseCh
		s.pauseMu.Unlock()

		if paused {
			select {
			case <-ctx.Done():
				return
			case <-pauseCh:
				continue
			}
		}

		fetches := s.client.PollFetches(ctx)

		if ctx.Err() != nil {
			return
		}

		fetches.EachError(func(t string, p int32, err error) {
			slog.Warn("observer fetch error", "topic", t, "partition", p, "err", err)
		})

		fetches.EachRecord(func(r *kgo.Record) {
			keyDisplay, keyDecoded := decodeKey(r.Key)
			emit(KafkaMessage{
				Topic:      r.Topic,
				Partition:  r.Partition,
				Offset:     r.Offset,
				Key:        keyDisplay,
				DecodedKey: keyDecoded,
				Value:      decode(r.Value),
				Timestamp:  r.Timestamp,
				Headers:    convertHeaders(r.Headers),
			})
		})
	}
}
