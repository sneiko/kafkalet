package profile

import (
	"errors"
	"path/filepath"
	"testing"

	keyring "github.com/zalando/go-keyring"
)

func testFileStore(t *testing.T) *fileStore {
	t.Helper()
	dir := t.TempDir()
	var key [32]byte
	copy(key[:], "test-encryption-key-32-bytes!!!!")
	return &fileStore{
		path: filepath.Join(dir, "secrets.enc"),
		key:  key,
	}
}

func TestFileStoreEncryptDecrypt(t *testing.T) {
	fs := testFileStore(t)

	tests := []struct {
		name      string
		plaintext []byte
	}{
		{"empty", []byte{}},
		{"short", []byte("hello")},
		{"longer text", []byte("the quick brown fox jumps over the lazy dog")},
		{"binary data", []byte{0x00, 0x01, 0xFF, 0xFE, 0x80}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ciphertext, err := fs.encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("encrypt: %v", err)
			}

			got, err := fs.decrypt(ciphertext)
			if err != nil {
				t.Fatalf("decrypt: %v", err)
			}

			if len(got) != len(tt.plaintext) {
				t.Fatalf("length mismatch: got %d, want %d", len(got), len(tt.plaintext))
			}
			for i := range got {
				if got[i] != tt.plaintext[i] {
					t.Fatalf("byte %d: got %#x, want %#x", i, got[i], tt.plaintext[i])
				}
			}
		})
	}
}

func TestFileStoreDecryptTampered(t *testing.T) {
	fs := testFileStore(t)

	plaintext := []byte("sensitive data")
	ciphertext, err := fs.encrypt(plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	// Flip a byte in the middle of the ciphertext (past the nonce).
	idx := len(ciphertext) / 2
	ciphertext[idx] ^= 0xFF

	_, err = fs.decrypt(ciphertext)
	if err == nil {
		t.Fatal("expected error decrypting tampered ciphertext, got nil")
	}
}

func TestFileStoreDecryptTooShort(t *testing.T) {
	fs := testFileStore(t)

	tests := []struct {
		name       string
		ciphertext []byte
	}{
		{"empty", []byte{}},
		{"one byte", []byte{0x42}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := fs.decrypt(tt.ciphertext)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if err.Error() != "ciphertext too short" {
				t.Fatalf("expected 'ciphertext too short', got %q", err.Error())
			}
		})
	}
}

func TestFileStoreSetGet(t *testing.T) {
	fs := testFileStore(t)

	if err := fs.Set("svc", "user1", "password123"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	got, err := fs.Get("svc", "user1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "password123" {
		t.Fatalf("got %q, want %q", got, "password123")
	}
}

func TestFileStoreGetMissing(t *testing.T) {
	fs := testFileStore(t)

	_, err := fs.Get("svc", "nonexistent")
	if !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("expected keyring.ErrNotFound, got %v", err)
	}
}

func TestFileStoreDelete(t *testing.T) {
	fs := testFileStore(t)

	if err := fs.Set("svc", "key1", "val1"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	if err := fs.Delete("svc", "key1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err := fs.Get("svc", "key1")
	if !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("expected keyring.ErrNotFound after delete, got %v", err)
	}
}

func TestFileStoreDeleteMissing(t *testing.T) {
	fs := testFileStore(t)

	// Write something so the file exists, then delete a non-existent key.
	if err := fs.Set("svc", "exists", "val"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	err := fs.Delete("svc", "nonexistent")
	if !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("expected keyring.ErrNotFound, got %v", err)
	}
}

func TestFileStoreDeleteNilData(t *testing.T) {
	fs := testFileStore(t)

	// No file on disk yet, data will be nil.
	err := fs.Delete("svc", "key1")
	if err != nil {
		t.Fatalf("expected nil error when data is nil, got %v", err)
	}
}

func TestFileStoreMultipleKeys(t *testing.T) {
	fs := testFileStore(t)

	entries := []struct {
		service string
		key     string
		value   string
	}{
		{"svc-a", "key1", "alpha"},
		{"svc-a", "key2", "beta"},
		{"svc-b", "key1", "gamma"},
		{"svc-b", "key2", "delta"},
	}

	for _, e := range entries {
		if err := fs.Set(e.service, e.key, e.value); err != nil {
			t.Fatalf("Set(%q, %q): %v", e.service, e.key, err)
		}
	}

	for _, e := range entries {
		got, err := fs.Get(e.service, e.key)
		if err != nil {
			t.Fatalf("Get(%q, %q): %v", e.service, e.key, err)
		}
		if got != e.value {
			t.Fatalf("Get(%q, %q) = %q, want %q", e.service, e.key, got, e.value)
		}
	}
}

func TestFileStoreOverwrite(t *testing.T) {
	fs := testFileStore(t)

	if err := fs.Set("svc", "key1", "first"); err != nil {
		t.Fatalf("Set (first): %v", err)
	}

	if err := fs.Set("svc", "key1", "second"); err != nil {
		t.Fatalf("Set (second): %v", err)
	}

	got, err := fs.Get("svc", "key1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "second" {
		t.Fatalf("got %q, want %q", got, "second")
	}
}
