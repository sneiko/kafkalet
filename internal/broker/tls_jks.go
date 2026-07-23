package broker

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

// convertTruststoreToPEM converts a JKS or PKCS12 truststore to PEM format.
// It uses the Java keytool command if available, otherwise falls back to openssl.
// Returns the path to a temporary PEM file that should be cleaned up after use.
func convertTruststoreToPEM(truststorePath, truststorePassword string) (string, error) {
	if truststorePath == "" {
		return "", nil
	}

	ext := strings.ToLower(filepath.Ext(truststorePath))
	
	// Try keytool first (works with JKS and PKCS12)
	pemPath, err := convertWithKeytool(truststorePath, truststorePassword)
	if err == nil {
		return pemPath, nil
	}

	// Fall back to openssl (works with PKCS12)
	if ext == ".p12" || ext == ".pkcs12" {
		pemPath, err = convertWithOpenSSL(truststorePath, truststorePassword)
		if err == nil {
			return pemPath, nil
		}
	}

	return "", fmt.Errorf("failed to convert truststore: %w", err)
}

// convertWithKeytool uses Java keytool to export certificates from truststore.
func convertWithKeytool(truststorePath, password string) (string, error) {
	// Detect truststore type
	storeType := "JKS"
	ext := strings.ToLower(filepath.Ext(truststorePath))
	if ext == ".p12" || ext == ".pkcs12" {
		storeType = "PKCS12"
	}

	// Create temp directory for certificates
	tempDir, err := os.MkdirTemp("", "kafkalet-truststore-*")
	if err != nil {
		return "", fmt.Errorf("create temp dir: %w", err)
	}

	// List all aliases in the truststore
	listCmd := hideConsoleWindow(exec.Command("keytool", "-list", "-keystore", truststorePath, "-storepass", password, "-storetype", storeType))
	output, err := listCmd.CombinedOutput()
	if err != nil {
		os.RemoveAll(tempDir)
		outputStr := string(output)
		if strings.Contains(outputStr, "password") || strings.Contains(outputStr, "Keystore was tampered") {
			return "", fmt.Errorf("неверный пароль truststore")
		}
		if strings.Contains(outputStr, "was not found") {
			return "", fmt.Errorf("файл truststore не найден")
		}
		return "", fmt.Errorf("ошибка чтения truststore (проверьте файл и пароль)")
	}

	// Parse aliases from output
	aliases := parseKeytoolAliases(string(output))
	if len(aliases) == 0 {
		os.RemoveAll(tempDir)
		return "", fmt.Errorf("no certificates found in truststore")
	}

	// Export each certificate
	var pemBlocks []*pem.Block
	for _, alias := range aliases {
		certCmd := hideConsoleWindow(exec.Command("keytool", "-exportcert", "-keystore", truststorePath, "-storepass", password, "-storetype", storeType, "-alias", alias, "-rfc"))
		certOut, err := certCmd.Output()
		if err != nil {
			os.RemoveAll(tempDir)
			return "", fmt.Errorf("ошибка экспорта сертификата из truststore")
		}

		// Parse PEM blocks from certificate
		for {
			block, rest := pem.Decode(certOut)
			if block == nil {
				break
			}
			if block.Type == "CERTIFICATE" {
				pemBlocks = append(pemBlocks, block)
			}
			certOut = rest
		}
	}

	if len(pemBlocks) == 0 {
		os.RemoveAll(tempDir)
		return "", fmt.Errorf("no valid certificates exported")
	}

	// Write combined PEM file
	pemPath := filepath.Join(tempDir, "truststore.pem")
	pemFile, err := os.Create(pemPath)
	if err != nil {
		os.RemoveAll(tempDir)
		return "", fmt.Errorf("create pem file: %w", err)
	}
	defer pemFile.Close()

	for _, block := range pemBlocks {
		if err := pem.Encode(pemFile, block); err != nil {
			os.RemoveAll(tempDir)
			return "", fmt.Errorf("encode pem: %w", err)
		}
	}

	return pemPath, nil
}

// convertWithOpenSSL uses openssl to convert PKCS12 to PEM.
func convertWithOpenSSL(truststorePath, password string) (string, error) {
	tempDir, err := os.MkdirTemp("", "kafkalet-truststore-*")
	if err != nil {
		return "", fmt.Errorf("create temp dir: %w", err)
	}

	pemPath := filepath.Join(tempDir, "truststore.pem")
	
	// openssl pkcs12 -in truststore.p12 -out truststore.pem -nodes -passin pass:password
	cmd := hideConsoleWindow(exec.Command("openssl", "pkcs12", "-in", truststorePath, "-out", pemPath, "-nodes", "-passin", "pass:"+password))
	output, err := cmd.CombinedOutput()
	if err != nil {
		os.RemoveAll(tempDir)
		outputStr := string(output)
		if strings.Contains(outputStr, "password") || strings.Contains(outputStr, "incorrect") {
			return "", fmt.Errorf("неверный пароль truststore")
		}
		return "", fmt.Errorf("ошибка чтения truststore (проверьте файл и пароль)")
	}

	return pemPath, nil
}

// parseKeytoolAliases extracts certificate aliases from keytool -list output.
func parseKeytoolAliases(output string) []string {
	var aliases []string
	lines := strings.Split(output, "\n")
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Look for lines like: "aliasname, Jul 15, 2024, trustedCertEntry,"
		if strings.Contains(line, ",") {
			parts := strings.Split(line, ",")
			if len(parts) > 0 {
				alias := strings.TrimSpace(parts[0])
				if alias != "" && !strings.HasPrefix(alias, "#") {
					aliases = append(aliases, alias)
				}
			}
		}
	}
	
	return aliases
}

// loadTruststorePEM loads certificates from a PEM file (converted from truststore).
func loadTruststorePEM(pemPath string) (*x509.CertPool, error) {
	pemData, err := os.ReadFile(pemPath)
	if err != nil {
		return nil, fmt.Errorf("read truststore pem: %w", err)
	}

	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pemData) {
		return nil, fmt.Errorf("no valid certificates in %s", pemPath)
	}

	return pool, nil
}

// hideConsoleWindow hides the console window for Windows processes only.
func hideConsoleWindow(cmd *exec.Cmd) *exec.Cmd {
	if runtime.GOOS == "windows" {
		if cmd.SysProcAttr == nil {
			cmd.SysProcAttr = &syscall.SysProcAttr{}
		}
		cmd.SysProcAttr.HideWindow = true
	}
	return cmd
}