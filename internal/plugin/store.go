package plugin

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/google/uuid"
	"kafkalet/internal/config"
)

// Store persists plugins to plugins.json in the user config directory.
type Store struct{}

func NewStore() *Store { return &Store{} }

func (s *Store) List() ([]Plugin, error) {
	path, err := config.PluginsFilePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return []Plugin{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read plugins: %w", err)
	}
	var plugins []Plugin
	if err := json.Unmarshal(data, &plugins); err != nil {
		return nil, fmt.Errorf("parse plugins: %w", err)
	}
	return plugins, nil
}

// Save creates or updates a plugin. If p.ID is empty, a new UUID is assigned.
func (s *Store) Save(p Plugin) (Plugin, error) {
	plugins, err := s.List()
	if err != nil {
		return Plugin{}, err
	}
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	found := false
	for i, existing := range plugins {
		if existing.ID == p.ID {
			plugins[i] = p
			found = true
			break
		}
	}
	if !found {
		plugins = append(plugins, p)
	}
	return p, s.write(plugins)
}

func (s *Store) Delete(id string) error {
	plugins, err := s.List()
	if err != nil {
		return err
	}
	filtered := plugins[:0]
	for _, p := range plugins {
		if p.ID != id {
			filtered = append(filtered, p)
		}
	}
	return s.write(filtered)
}

func (s *Store) write(plugins []Plugin) error {
	path, err := config.PluginsFilePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(plugins, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
