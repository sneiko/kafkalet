package message

import (
	"encoding/base64"
	"fmt"
	"unicode/utf8"

	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/schema"
)

// Header is a single Kafka record header.
type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// SafeString converts a byte slice to string. Uses base64 if the bytes
// are not valid UTF-8 (e.g. binary keys/values).
func SafeString(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	if utf8.Valid(b) {
		return string(b)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// ConvertHeaders converts franz-go record headers to Header slice.
func ConvertHeaders(headers []kgo.RecordHeader) []Header {
	result := make([]Header, 0, len(headers))
	for _, h := range headers {
		result = append(result, Header{
			Key:   h.Key,
			Value: SafeString(h.Value),
		})
	}
	return result
}

// BuildDecode returns a value-decode function backed by Schema Registry (if reg != nil).
// When reg is nil the function falls back to SafeString (UTF-8 or base64).
func BuildDecode(reg *schema.Registry) func([]byte) string {
	if reg == nil {
		return SafeString
	}
	return func(raw []byte) string {
		decoded, ok, err := schema.TryDecodeAvro(reg, raw)
		if ok {
			if err != nil {
				return fmt.Sprintf("[avro decode error: %v]", err)
			}
			return decoded
		}
		return SafeString(raw)
	}
}
