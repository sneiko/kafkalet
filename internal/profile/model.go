package profile

// Profile groups broker connections that belong to one environment (prod, staging, dev).
// Only one profile is active at a time.
type Profile struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Brokers []Broker `json:"brokers"`
}

// NamedCredential is a named set of SASL credentials for a broker.
// Multiple credentials allow different users/ACLs on the same cluster.
type NamedCredential struct {
	ID   string     `json:"id"`
	Name string     `json:"name"`
	SASL SASLConfig `json:"sasl"`
}

// Broker is a Kafka cluster connection config within a profile.
type Broker struct {
	ID                  string               `json:"id"`
	Name                string               `json:"name"`
	Addresses           []string             `json:"addresses"` // host:port bootstrap servers
	SASL                SASLConfig           `json:"sasl"`
	TLS                 TLSConfig            `json:"tls"`
	SchemaRegistry      SchemaRegistryConfig `json:"schemaRegistry"`
	Credentials         []NamedCredential    `json:"credentials,omitempty"`
	ActiveCredentialID  string               `json:"activeCredentialID,omitempty"`
}

// SchemaRegistryConfig holds connection settings for a Confluent-compatible Schema Registry.
// The password (for HTTP Basic auth) lives in the OS keychain.
type SchemaRegistryConfig struct {
	URL      string `json:"url"`      // e.g. http://localhost:8081; empty = disabled
	Username string `json:"username"` // optional, for Basic auth
}

// SASLConfig holds SASL auth params. The password/token lives in the OS keychain.
//
// For PLAIN / SCRAM-*: Username + password in keychain.
// For OAUTHBEARER:
//   - OAuthTokenURL empty  → static Bearer token stored in keychain
//   - OAuthTokenURL set    → client_credentials flow: OAuthClientID + client secret in keychain
type SASLConfig struct {
	Mechanism     string   `json:"mechanism"`               // PLAIN | SCRAM-SHA-256 | SCRAM-SHA-512 | OAUTHBEARER
	Username      string   `json:"username"`                // not used for OAUTHBEARER
	OAuthTokenURL string   `json:"oauthTokenURL,omitempty"` // token endpoint for client_credentials flow
	OAuthClientID string   `json:"oauthClientID,omitempty"` // client_id for client_credentials flow
	OAuthScopes   []string `json:"oauthScopes,omitempty"`   // requested scopes
}

// TLSConfig holds TLS settings. Cert paths point to PEM files on disk.
type TLSConfig struct {
	Enabled            bool   `json:"enabled"`
	InsecureSkipVerify bool   `json:"insecureSkipVerify"` // dev only
	CACertPath         string `json:"caCertPath"`
	ClientCertPath     string `json:"clientCertPath"`
	ClientKeyPath      string `json:"clientKeyPath"`
}
