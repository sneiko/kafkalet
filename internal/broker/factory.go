package broker

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/oauth"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"kafkalet/internal/profile"
)

// NewClient creates a franz-go client from broker config + plaintext password.
// Caller is responsible for calling client.Close().
func NewClient(b profile.Broker, password string, extra ...kgo.Opt) (*kgo.Client, error) {
	opts := []kgo.Opt{
		kgo.SeedBrokers(b.Addresses...),
		kgo.DialTimeout(TimeoutDial),
	}

	if b.SASL.Mechanism != "" {
		saslOpt, err := buildSASL(b.SASL, password)
		if err != nil {
			return nil, err
		}
		opts = append(opts, saslOpt)
	}

	if b.TLS.Enabled {
		tlsCfg, err := buildTLS(b.TLS)
		if err != nil {
			return nil, err
		}
		opts = append(opts, kgo.DialTLSConfig(tlsCfg))
	}

	opts = append(opts, extra...)
	return kgo.NewClient(opts...)
}

func buildSASL(cfg profile.SASLConfig, password string) (kgo.Opt, error) {
	switch cfg.Mechanism {
	case "PLAIN":
		return kgo.SASL(plain.Auth{User: cfg.Username, Pass: password}.AsMechanism()), nil
	case "SCRAM-SHA-256":
		return kgo.SASL(scram.Auth{User: cfg.Username, Pass: password}.AsSha256Mechanism()), nil
	case "SCRAM-SHA-512":
		return kgo.SASL(scram.Auth{User: cfg.Username, Pass: password}.AsSha512Mechanism()), nil
	case "OAUTHBEARER":
		token := password
		if cfg.OAuthTokenURL != "" {
			var err error
			token, err = fetchClientCredentialsToken(cfg.OAuthTokenURL, cfg.OAuthClientID, password, cfg.OAuthScopes)
			if err != nil {
				return nil, fmt.Errorf("oauth token fetch: %w", err)
			}
		}
		return kgo.SASL(oauth.Auth{Token: token, Extensions: cfg.OAuthExtensions}.AsMechanism()), nil
	default:
		return nil, fmt.Errorf("unsupported SASL mechanism: %q", cfg.Mechanism)
	}
}

// fetchClientCredentialsToken exchanges client credentials for a Bearer token
// using the OAuth 2.0 client_credentials grant.
func fetchClientCredentialsToken(tokenURL, clientID, clientSecret string, scopes []string) (string, error) {
	vals := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
	}
	if len(scopes) > 0 {
		vals.Set("scope", strings.Join(scopes, " "))
	}

	resp, err := http.PostForm(tokenURL, vals) //nolint:noctx // short-lived auth call
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token endpoint HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("%s: %s", result.Error, result.ErrorDesc)
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("empty access_token in response")
	}
	return result.AccessToken, nil
}

func buildTLS(cfg profile.TLSConfig) (*tls.Config, error) {
	tlsCfg := &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify, //nolint:gosec // user-controlled dev option
	}

	if cfg.CACertPath != "" {
		pem, err := os.ReadFile(cfg.CACertPath)
		if err != nil {
			return nil, fmt.Errorf("read CA cert: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("invalid CA cert PEM in %s", cfg.CACertPath)
		}
		tlsCfg.RootCAs = pool
	}

	if cfg.ClientCertPath != "" && cfg.ClientKeyPath != "" {
		cert, err := tls.LoadX509KeyPair(cfg.ClientCertPath, cfg.ClientKeyPath)
		if err != nil {
			return nil, fmt.Errorf("load client cert/key: %w", err)
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}

	return tlsCfg, nil
}
