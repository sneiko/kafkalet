package stream

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/broker"
	"kafkalet/internal/profile"
)

// ConsumerSession joins a named consumer group and tracks offset commits.
// Auto-commit is disabled — the user must call Commit explicitly to persist progress.
type ConsumerSession struct {
	id      string
	groupID string
	client  *kgo.Client
	cancel  context.CancelFunc
}

func (s *ConsumerSession) ID() string { return s.id }

func (s *ConsumerSession) Stop() { s.cancel() }

// Commit persists all marked-but-not-yet-committed offsets to Kafka.
// Called on explicit user action ("Commit" button in the UI).
func (s *ConsumerSession) Commit(ctx context.Context) error {
	return s.client.CommitUncommittedOffsets(ctx)
}

// newConsumer creates a ConsumerSession and starts the poll goroutine.
// decode converts raw record value bytes to a display string (e.g. Avro → JSON).
func newConsumer(
	appCtx context.Context,
	sessionID string,
	b profile.Broker,
	password string,
	topic string,
	groupID string,
	resetOffset kgo.Offset,
	decode func([]byte) string,
	emit func(KafkaMessage),
) (*ConsumerSession, error) {
	client, err := broker.NewClient(b, password,
		kgo.ConsumerGroup(groupID),
		kgo.ConsumeTopics(topic),
		kgo.ConsumeResetOffset(resetOffset),
		kgo.DisableAutoCommit(),
	)
	if err != nil {
		return nil, fmt.Errorf("consumer %s: %w", sessionID, err)
	}

	sessCtx, cancel := context.WithCancel(appCtx)
	s := &ConsumerSession{
		id:      sessionID,
		groupID: groupID,
		client:  client,
		cancel:  cancel,
	}

	go s.pollLoop(sessCtx, decode, emit)
	return s, nil
}

func (s *ConsumerSession) pollLoop(ctx context.Context, decode func([]byte) string, emit func(KafkaMessage)) {
	defer s.client.Close()

	for {
		fetches := s.client.PollFetches(ctx)

		if ctx.Err() != nil {
			return
		}

		fetches.EachError(func(t string, p int32, err error) {
			slog.Warn("consumer fetch error", "topic", t, "partition", p, "err", err)
		})

		fetches.EachRecord(func(r *kgo.Record) {
			// Mark the record so it can be committed via CommitUncommittedOffsets.
			s.client.MarkCommitRecords(r)
			emit(KafkaMessage{
				Topic:     r.Topic,
				Partition: r.Partition,
				Offset:    r.Offset,
				Key:       safeString(r.Key),
				Value:     decode(r.Value),
				Timestamp: r.Timestamp,
				Headers:   convertHeaders(r.Headers),
			})
		})
	}
}
