package broker

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"kafkalet/internal/profile"
)

func TestBuildSASL_PLAIN(t *testing.T) {
	cfg := profile.SASLConfig{Mechanism: "PLAIN", Username: "user"}
	opt, err := buildSASL(cfg, "pass")
	if err != nil {
		t.Fatalf("buildSASL PLAIN: %v", err)
	}
	if opt == nil {
		t.Fatal("buildSASL PLAIN returned nil opt")
	}
}

func TestBuildSASL_SCRAM256(t *testing.T) {
	cfg := profile.SASLConfig{Mechanism: "SCRAM-SHA-256", Username: "user"}
	opt, err := buildSASL(cfg, "pass")
	if err != nil {
		t.Fatalf("buildSASL SCRAM-SHA-256: %v", err)
	}
	if opt == nil {
		t.Fatal("buildSASL SCRAM-SHA-256 returned nil opt")
	}
}

func TestBuildSASL_SCRAM512(t *testing.T) {
	cfg := profile.SASLConfig{Mechanism: "SCRAM-SHA-512", Username: "user"}
	opt, err := buildSASL(cfg, "pass")
	if err != nil {
		t.Fatalf("buildSASL SCRAM-SHA-512: %v", err)
	}
	if opt == nil {
		t.Fatal("buildSASL SCRAM-SHA-512 returned nil opt")
	}
}

func TestBuildSASL_OAuthBearer_Static(t *testing.T) {
	cfg := profile.SASLConfig{Mechanism: "OAUTHBEARER"}
	opt, err := buildSASL(cfg, "my-token")
	if err != nil {
		t.Fatalf("buildSASL OAUTHBEARER static: %v", err)
	}
	if opt == nil {
		t.Fatal("buildSASL OAUTHBEARER static returned nil opt")
	}
}

func TestBuildSASL_OAuthBearer_ClientCredentials(t *testing.T) {
	cfg := profile.SASLConfig{
		Mechanism:     "OAUTHBEARER",
		OAuthTokenURL: "https://auth.example.com/token",
		OAuthClientID: "client-id",
		OAuthScopes:   []string{"read", "write"},
	}
	opt, err := buildSASL(cfg, "client-secret")
	if err != nil {
		t.Fatalf("buildSASL OAUTHBEARER client_credentials: %v", err)
	}
	if opt == nil {
		t.Fatal("buildSASL OAUTHBEARER client_credentials returned nil opt")
	}
}

func TestBuildSASL_Unsupported(t *testing.T) {
	cfg := profile.SASLConfig{Mechanism: "GSSAPI"}
	_, err := buildSASL(cfg, "pass")
	if err == nil {
		t.Fatal("buildSASL with unsupported mechanism should error")
	}
}

func TestBuildTLS_InsecureSkipVerify(t *testing.T) {
	cfg := profile.TLSConfig{Enabled: true, InsecureSkipVerify: true}
	tlsCfg, err := buildTLS(cfg)
	if err != nil {
		t.Fatalf("buildTLS: %v", err)
	}
	if !tlsCfg.InsecureSkipVerify {
		t.Error("InsecureSkipVerify should be true")
	}
}

func TestBuildTLS_ValidCACert(t *testing.T) {
	caPath := writeTempCACert(t)
	cfg := profile.TLSConfig{Enabled: true, CACertPath: caPath}
	tlsCfg, err := buildTLS(cfg)
	if err != nil {
		t.Fatalf("buildTLS with valid CA cert: %v", err)
	}
	if tlsCfg.RootCAs == nil {
		t.Error("RootCAs should not be nil with CA cert")
	}
}

func TestBuildTLS_InvalidCACertPath(t *testing.T) {
	cfg := profile.TLSConfig{Enabled: true, CACertPath: "/nonexistent/ca.pem"}
	_, err := buildTLS(cfg)
	if err == nil {
		t.Fatal("buildTLS with invalid CA cert path should error")
	}
}

func TestBuildTLS_InvalidCACertContent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad-ca.pem")
	if err := os.WriteFile(path, []byte("not a PEM"), 0o600); err != nil {
		t.Fatalf("write bad cert: %v", err)
	}
	cfg := profile.TLSConfig{Enabled: true, CACertPath: path}
	_, err := buildTLS(cfg)
	if err == nil {
		t.Fatal("buildTLS with invalid PEM content should error")
	}
}

func TestBuildTLS_Defaults(t *testing.T) {
	cfg := profile.TLSConfig{Enabled: true}
	tlsCfg, err := buildTLS(cfg)
	if err != nil {
		t.Fatalf("buildTLS defaults: %v", err)
	}
	if tlsCfg.InsecureSkipVerify {
		t.Error("InsecureSkipVerify should default to false")
	}
	if tlsCfg.RootCAs != nil {
		t.Error("RootCAs should be nil without CA cert path")
	}
}

// writeTempCACert generates a self-signed CA cert PEM in a temp dir and returns its path.
func writeTempCACert(t *testing.T) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	dir := t.TempDir()
	path := filepath.Join(dir, "ca.pem")
	if err := os.WriteFile(path, certPEM, 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}
	return path
}
