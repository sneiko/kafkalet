package schema

import (
	"encoding/binary"
	"fmt"

	"github.com/linkedin/goavro/v2"
)

const confluentMagicByte = 0x00

// TryDecodeAvro checks whether data uses the Confluent wire format:
//
//	byte  0    : magic byte 0x00
//	bytes 1–4  : big-endian schema ID (int32)
//	bytes 5+   : Avro binary payload
//
// Returns (decoded JSON, true, nil) on success.
// Returns ("", false, nil) if data does not start with the magic byte.
// Returns ("", true, err) if the wire format is recognised but decoding fails.
func TryDecodeAvro(reg *Registry, data []byte) (string, bool, error) {
	if len(data) < 5 || data[0] != confluentMagicByte {
		return "", false, nil
	}

	schemaID := int32(binary.BigEndian.Uint32(data[1:5]))
	payload := data[5:]

	schemaJSON, err := reg.GetSchema(schemaID)
	if err != nil {
		return "", true, fmt.Errorf("fetch schema %d: %w", schemaID, err)
	}

	codec, err := goavro.NewCodec(schemaJSON)
	if err != nil {
		return "", true, fmt.Errorf("parse schema %d: %w", schemaID, err)
	}

	native, _, err := codec.NativeFromBinary(payload)
	if err != nil {
		return "", true, fmt.Errorf("avro decode: %w", err)
	}

	textual, err := codec.TextualFromNative(nil, native)
	if err != nil {
		return "", true, fmt.Errorf("avro to json: %w", err)
	}

	return string(textual), true, nil
}
