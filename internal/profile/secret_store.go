package profile

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	keyring "github.com/zalando/go-keyring"

	"kafkalet/internal/config"
)

// secretStore abstracts secret persistence (OS keychain or file-based fallback).
type secretStore interface {
	Set(service, key, value string) error
	Get(service, key string) (string, error)
	Delete(service, key string) error
}

var (
	store     secretStore
	storeOnce sync.Once
)

func getStore() secretStore {
	storeOnce.Do(func() {
		store = initStore()
	})
	return store
}

func initStore() secretStore {
	// Probe the OS keychain with a test round-trip.
	const probe = "__kafkalet_probe__"
	if err := keyring.Set(keychainService, probe, "ok"); err == nil {
		if v, err := keyring.Get(keychainService, probe); err == nil && v == "ok" {
			_ = keyring.Delete(keychainService, probe)
			slog.Debug("using OS keychain for secrets")
			return &keyringStore{}
		}
		_ = keyring.Delete(keychainService, probe)
	}
	slog.Warn("OS keychain unavailable, using file-based secret store")
	fs, err := newFileStore()
	if err != nil {
		slog.Error("failed to init file secret store, secrets will not persist", "err", err)
		return &keyringStore{} // fall through to keyring (will error on each call)
	}
	return fs
}

// ── keyringStore ─────────────────────────────────────────────────────────────

type keyringStore struct{}

func (k *keyringStore) Set(service, key, value string) error {
	return keyring.Set(service, key, value)
}

func (k *keyringStore) Get(service, key string) (string, error) {
	return keyring.Get(service, key)
}

func (k *keyringStore) Delete(service, key string) error {
	return keyring.Delete(service, key)
}

// ── fileStore ────────────────────────────────────────────────────────────────

// fileStore persists secrets as an AES-GCM encrypted JSON file.
// Used as a fallback when the OS keychain is unavailable (e.g. Linux without GNOME Keyring).
type fileStore struct {
	mu   sync.Mutex
	path string
	key  [32]byte // AES-256 key derived from machine identity
}

func newFileStore() (*fileStore, error) {
	dir, err := config.Dir()
	if err != nil {
		return nil, fmt.Errorf("config dir: %w", err)
	}
	key, err := deriveKey()
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}
	return &fileStore{
		path: filepath.Join(dir, "secrets.enc"),
		key:  key,
	}, nil
}

func (f *fileStore) Set(service, key, value string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, _ := f.loadLocked()
	if data == nil {
		data = make(map[string]string)
	}
	data[service+"\x00"+key] = value
	return f.saveLocked(data)
}

func (f *fileStore) Get(service, key string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, err := f.loadLocked()
	if err != nil {
		return "", err
	}
	v, ok := data[service+"\x00"+key]
	if !ok {
		return "", keyring.ErrNotFound
	}
	return v, nil
}

func (f *fileStore) Delete(service, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, _ := f.loadLocked()
	if data == nil {
		return nil
	}
	k := service + "\x00" + key
	if _, ok := data[k]; !ok {
		return keyring.ErrNotFound
	}
	delete(data, k)
	return f.saveLocked(data)
}

func (f *fileStore) loadLocked() (map[string]string, error) {
	raw, err := os.ReadFile(f.path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	plaintext, err := f.decrypt(raw)
	if err != nil {
		return nil, fmt.Errorf("decrypt secrets: %w", err)
	}
	var data map[string]string
	if err := json.Unmarshal(plaintext, &data); err != nil {
		return nil, fmt.Errorf("unmarshal secrets: %w", err)
	}
	return data, nil
}

func (f *fileStore) saveLocked(data map[string]string) error {
	plaintext, err := json.Marshal(data)
	if err != nil {
		return err
	}
	ciphertext, err := f.encrypt(plaintext)
	if err != nil {
		return err
	}
	return os.WriteFile(f.path, ciphertext, 0o600)
}

func (f *fileStore) encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(f.key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (f *fileStore) decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(f.key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return nil, fmt.Errorf("ciphertext too short")
	}
	return gcm.Open(nil, ciphertext[:ns], ciphertext[ns:], nil)
}

// deriveKey produces a deterministic AES-256 key from machine identity.
func deriveKey() ([32]byte, error) {
	seed, err := machineID()
	if err != nil {
		return [32]byte{}, err
	}
	return sha256.Sum256([]byte("kafkalet-secrets:" + seed)), nil
}

// machineID returns a stable per-machine identifier.
func machineID() (string, error) {
	switch runtime.GOOS {
	case "linux":
		for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
			if b, err := os.ReadFile(p); err == nil {
				if id := strings.TrimSpace(string(b)); id != "" {
					return id, nil
				}
			}
		}
	case "darwin":
		// IOPlatformUUID is stable across reboots
		if b, err := os.ReadFile("/Library/Preferences/SystemConfiguration/com.apple.smb.server.plist"); err == nil {
			return fmt.Sprintf("mac:%x", sha256.Sum256(b)), nil
		}
	}
	// Fallback: hostname + home dir (not ideal but stable enough)
	host, _ := os.Hostname()
	home, _ := os.UserHomeDir()
	if host == "" && home == "" {
		return "", fmt.Errorf("cannot determine machine identity")
	}
	return fmt.Sprintf("fallback:%s:%s", host, home), nil
}
