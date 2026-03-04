package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// Dir returns the kafkalet config directory, creating it if needed.
// macOS: ~/Library/Application Support/kafkalet
// Windows: %AppData%\kafkalet
// Linux: ~/.config/kafkalet
func Dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("user config dir: %w", err)
	}
	dir := filepath.Join(base, "kafkalet")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create config dir: %w", err)
	}
	return dir, nil
}

// ProfilesFilePath returns the path to profiles.json.
func ProfilesFilePath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "profiles.json"), nil
}

// PluginsFilePath returns the path to plugins.json.
func PluginsFilePath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "plugins.json"), nil
}
