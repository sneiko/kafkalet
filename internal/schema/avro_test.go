package schema

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/linkedin/goavro/v2"
)

// newTestRegistry creates a Registry backed by httptest.Server that returns
// the given schema JSON for any schema ID.
func newTestRegistry(t *testing.T, schemaJSON string) *Registry {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]string{"schema": schemaJSON}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL, "", "")
}

// newTestRegistryError creates a Registry backed by httptest.Server that returns HTTP 404.
func newTestRegistryError(t *testing.T) *Registry {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL, "", "")
}

// encodeAvro encodes a native Go value into Confluent wire format bytes.
func encodeAvro(t *testing.T, schemaJSON string, schemaID int32, native any) []byte {
	t.Helper()
	codec, err := goavro.NewCodec(schemaJSON)
	if err != nil {
		t.Fatalf("create codec: %v", err)
	}
	payload, err := codec.BinaryFromNative(nil, native)
	if err != nil {
		t.Fatalf("encode avro: %v", err)
	}
	// Confluent wire format: magic(1) + schemaID(4) + payload
	buf := make([]byte, 5+len(payload))
	buf[0] = 0x00
	binary.BigEndian.PutUint32(buf[1:5], uint32(schemaID))
	copy(buf[5:], payload)
	return buf
}

func TestTryDecodeAvro_Success(t *testing.T) {
	schemaJSON := `{"type":"record","name":"Test","fields":[{"name":"name","type":"string"}]}`
	reg := newTestRegistry(t, schemaJSON)

	data := encodeAvro(t, schemaJSON, 1, map[string]any{"name": "alice"})

	decoded, isAvro, err := TryDecodeAvro(reg, data)
	if err != nil {
		t.Fatalf("TryDecodeAvro: %v", err)
	}
	if !isAvro {
		t.Fatal("expected isAvro=true")
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(decoded), &result); err != nil {
		t.Fatalf("unmarshal decoded: %v", err)
	}
	if result["name"] != "alice" {
		t.Errorf("decoded name = %v, want alice", result["name"])
	}
}

func TestTryDecodeAvro_NotConfluent(t *testing.T) {
	reg := newTestRegistry(t, `{}`)

	tests := []struct {
		name string
		data []byte
	}{
		{"nil data", nil},
		{"empty data", []byte{}},
		{"1 byte", []byte{0x01}},
		{"4 bytes no magic", []byte{0x01, 0x02, 0x03, 0x04}},
		{"5 bytes wrong magic", []byte{0x01, 0x00, 0x00, 0x00, 0x01}},
		{"plain text", []byte("hello world")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, isAvro, err := TryDecodeAvro(reg, tt.data)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if isAvro {
				t.Error("expected isAvro=false for non-Confluent data")
			}
		})
	}
}

func TestTryDecodeAvro_LessThan5Bytes(t *testing.T) {
	reg := newTestRegistry(t, `{}`)

	for i := range 5 {
		data := make([]byte, i)
		if i > 0 {
			data[0] = 0x00 // magic byte present but not enough data
		}
		t.Run(fmt.Sprintf("%d_bytes", i), func(t *testing.T) {
			_, isAvro, err := TryDecodeAvro(reg, data)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if isAvro {
				t.Error("expected isAvro=false for short data")
			}
		})
	}
}

func TestTryDecodeAvro_SchemaFetchError(t *testing.T) {
	reg := newTestRegistryError(t)

	// Valid wire format but registry returns 404.
	data := make([]byte, 10)
	data[0] = 0x00
	binary.BigEndian.PutUint32(data[1:5], 999)

	_, isAvro, err := TryDecodeAvro(reg, data)
	if !isAvro {
		t.Error("expected isAvro=true (wire format recognised)")
	}
	if err == nil {
		t.Fatal("expected error from schema fetch")
	}
}

func TestTryDecodeAvro_InvalidPayload(t *testing.T) {
	schemaJSON := `{"type":"record","name":"Test","fields":[{"name":"name","type":"string"}]}`
	reg := newTestRegistry(t, schemaJSON)

	// Valid wire format header but garbage payload.
	data := make([]byte, 10)
	data[0] = 0x00
	binary.BigEndian.PutUint32(data[1:5], 1)
	copy(data[5:], []byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF})

	_, isAvro, err := TryDecodeAvro(reg, data)
	if !isAvro {
		t.Error("expected isAvro=true (wire format recognised)")
	}
	if err == nil {
		t.Fatal("expected error from invalid avro payload")
	}
}
