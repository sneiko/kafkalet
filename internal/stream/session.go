package stream

import (
	"encoding/base64"
	"time"
	"unicode/utf8"

	"github.com/twmb/franz-go/pkg/kgo"
)

// Mode indicates how messages are read from Kafka.
type Mode int

const (
	ModeObserver Mode = iota // read without consumer group (no commits)
	ModeConsumer             // join a consumer group, commit offsets
)

// KafkaMessage is the payload sent to the frontend via Wails events.
type KafkaMessage struct {
	Topic     string    `json:"topic"`
	Partition int32     `json:"partition"`
	Offset    int64     `json:"offset"`
	Key       string    `json:"key"`   // UTF-8 text, or base64 if binary
	Value     string    `json:"value"` // UTF-8 text, or base64 if binary
	Timestamp time.Time `json:"timestamp"`
	Headers   []Header  `json:"headers"`
}

// Header is a single Kafka record header.
type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Session is the common interface for all stream session types.
type Session interface {
	ID() string
	Stop()
}

// safeString converts a byte slice to string. Uses base64 if the bytes
// are not valid UTF-8 (e.g. binary keys/values).
func safeString(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	if utf8.Valid(b) {
		return string(b)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// convertHeaders converts franz-go record headers to our Header type.
func convertHeaders(headers []kgo.RecordHeader) []Header {
	result := make([]Header, 0, len(headers))
	for _, h := range headers {
		result = append(result, Header{
			Key:   h.Key,
			Value: safeString(h.Value),
		})
	}
	return result
}
