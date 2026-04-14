package stream

import (
	"time"

	"kafkalet/internal/message"
)

// Mode indicates how messages are read from Kafka.
type Mode int

const (
	ModeObserver Mode = iota // read without consumer group (no commits)
	ModeConsumer             // join a consumer group, commit offsets
)

// KafkaMessage is the payload sent to the frontend via Wails events.
type KafkaMessage struct {
	Topic     string           `json:"topic"`
	Partition int32            `json:"partition"`
	Offset    int64            `json:"offset"`
	Key       string           `json:"key"`   // UTF-8 text, or base64 if binary
	Value     string           `json:"value"` // UTF-8 text, or base64 if binary
	Timestamp time.Time        `json:"timestamp"`
	Headers   []message.Header `json:"headers"`
}

// Session is the common interface for all stream session types.
type Session interface {
	ID() string
	Stop()
}
