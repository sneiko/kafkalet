package stream

import (
	"encoding/base64"
	"encoding/hex"
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
	Topic      string    `json:"topic"`
	Partition  int32     `json:"partition"`
	Offset     int64     `json:"offset"`
	Key        string    `json:"key"`        // Raw: UTF-8 text, base64, or hex
	DecodedKey string    `json:"decodedKey"` // Decoded Avro JSON, or hex, or empty
	Value      string    `json:"value"`      // UTF-8 text, base64, or decoded Avro
	Timestamp  time.Time `json:"timestamp"`
	Headers    []Header  `json:"headers"`
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

// toHex converts bytes to human-readable hex string.
// Example: []byte{0x00, 0x01, 0x02} → "00 01 02"
func toHex(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	hexStr := hex.EncodeToString(b)
	// Insert spaces every 2 characters
	result := make([]byte, 0, len(hexStr)+len(hexStr)/2)
	for i := 0; i < len(hexStr); i += 2 {
		if i > 0 {
			result = append(result, ' ')
		}
		result = append(result, hexStr[i], hexStr[i+1])
	}
	return string(result)
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
