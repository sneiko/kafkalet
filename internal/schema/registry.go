package schema

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
)

// Registry fetches and caches Avro schemas from a Confluent-compatible Schema Registry.
type Registry struct {
	url    string
	auth   string // "user:pass" for Basic auth, empty if unauthenticated
	cache  sync.Map
	client *http.Client
}

// New creates a Registry. Pass empty username/password for unauthenticated access.
func New(url, username, password string) *Registry {
	r := &Registry{url: url, client: &http.Client{}}
	if username != "" {
		r.auth = base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	}
	return r
}

// GetSchema returns the Avro schema JSON for the given schema ID.
// Results are cached for the lifetime of the Registry.
func (r *Registry) GetSchema(id int32) (string, error) {
	if v, ok := r.cache.Load(id); ok {
		return v.(string), nil
	}
	schemaJSON, err := r.fetchSchema(id)
	if err != nil {
		return "", err
	}
	r.cache.Store(id, schemaJSON)
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
