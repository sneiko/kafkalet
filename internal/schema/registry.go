package schema

import (
	"container/list"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"

	"kafkalet/internal/profile"
	"kafkalet/internal/tlsutil"
)

const defaultMaxEntries = 500

// Registry fetches and caches Avro schemas from a Confluent-compatible Schema Registry.
// Uses an LRU cache with a configurable max size (default 500).
type Registry struct {
	url        string
	auth       string // "user:pass" for Basic auth, empty if unauthenticated
	client     *http.Client
	mu         sync.Mutex
	cache      map[int32]*list.Element
	evictList  *list.List
	maxEntries int
}

type lruEntry struct {
	key   int32
	value string
}

// New creates a Registry. Pass empty username/password for unauthenticated access.
func New(url, username, password string, tlsConfig profile.TLSConfig) *Registry {
	r := &Registry{
		url:        url,
		cache:      make(map[int32]*list.Element),
		evictList:  list.New(),
		maxEntries: defaultMaxEntries,
	}
	if username != "" {
		r.auth = base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	}

	httpClient := &http.Client{}
	if tlsConfig.Enabled || tlsConfig.TruststorePath != "" || tlsConfig.CACertPath != "" {
		if tlsCfg, err := buildTLS(tlsConfig); err == nil {
			httpClient.Transport = &http.Transport{
				TLSClientConfig: tlsCfg,
			}
		}
	}
	r.client = httpClient

	return r
}

// GetSchema returns the Avro schema JSON for the given schema ID.
// Results are cached with LRU eviction.
func (r *Registry) GetSchema(id int32) (string, error) {
	r.mu.Lock()
	if el, ok := r.cache[id]; ok {
		r.evictList.MoveToFront(el)
		val := el.Value.(*lruEntry).value
		r.mu.Unlock()
		return val, nil
	}
	r.mu.Unlock()

	// Fetch without holding the lock to avoid blocking other lookups.
	schemaJSON, err := r.fetchSchema(id)
	if err != nil {
		return "", err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	// Double-check: another goroutine may have fetched it concurrently.
	if el, ok := r.cache[id]; ok {
		r.evictList.MoveToFront(el)
		return el.Value.(*lruEntry).value, nil
	}

	el := r.evictList.PushFront(&lruEntry{key: id, value: schemaJSON})
	r.cache[id] = el

	if r.evictList.Len() > r.maxEntries {
		oldest := r.evictList.Back()
		if oldest != nil {
			r.evictList.Remove(oldest)
			delete(r.cache, oldest.Value.(*lruEntry).key)
		}
	}

	return schemaJSON, nil
}

func (r *Registry) fetchSchema(id int32) (string, error) {
	url := fmt.Sprintf("%s/schemas/ids/%d", r.url, id)
	req, err := http.NewRequest(http.MethodGet, url, nil) //nolint:noctx
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.schemaregistry.v1+json")
	if r.auth != "" {
		req.Header.Set("Authorization", "Basic "+r.auth)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("schema registry request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("schema registry HTTP %d: %s", resp.StatusCode, body)
	}

	var result struct {
		Schema string `json:"schema"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("decode schema response: %w", err)
	}
	if result.Schema == "" {
		return "", fmt.Errorf("empty schema in registry response")
	}
	return result.Schema, nil
}

func buildTLS(cfg profile.TLSConfig) (*tls.Config, error) {
	tlsCfg := &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify,
	}

	if cfg.TruststorePath != "" {
		slog.Debug("converting schema registry truststore", "path", cfg.TruststorePath, "hasPassword", cfg.TruststorePassword != "")
		pemPath, err := tlsutil.ConvertTruststoreToPEM(cfg.TruststorePath, cfg.TruststorePassword)
		if err != nil {
			return nil, fmt.Errorf("convert truststore (path=%s, hasPassword=%v): %w", cfg.TruststorePath, cfg.TruststorePassword != "", err)
		}
		slog.Debug("truststore converted successfully", "pemPath", pemPath)
		cfg.CACertPath = pemPath
	}

	if cfg.CACertPath != "" {
		pool, err := tlsutil.LoadTruststorePEM(cfg.CACertPath)
		if err != nil {
			return nil, err
		}
		tlsCfg.RootCAs = pool
	}

	if cfg.ClientCertPath != "" && cfg.ClientKeyPath != "" {
		cert, err := tls.LoadX509KeyPair(cfg.ClientCertPath, cfg.ClientKeyPath)
		if err != nil {
			return nil, fmt.Errorf("load client cert: %w", err)
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}

	return tlsCfg, nil
}
