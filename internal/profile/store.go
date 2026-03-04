package profile

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/google/uuid"
	"kafkalet/internal/config"
)

type storeData struct {
	ActiveProfileID string    `json:"activeProfileID"`
	Profiles        []Profile `json:"profiles"`
}

// Store is a thread-safe CRUD store for profiles backed by a JSON file.
type Store struct {
	path string
	mu   sync.RWMutex
	data storeData
}

// NewStore creates a Store, loading existing data from disk.
func NewStore() (*Store, error) {
	path, err := config.ProfilesFilePath()
	if err != nil {
		return nil, fmt.Errorf("profiles store: %w", err)
	}
	s := &Store{path: path}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		s.data = storeData{}
		return nil
	}
	if err != nil {
		return fmt.Errorf("read profiles: %w", err)
	}
	return json.Unmarshal(data, &s.data)
}

// save writes atomically: write to .tmp then rename.
func (s *Store) save() error {
	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write profiles tmp: %w", err)
	}
	return os.Rename(tmp, s.path)
}

// List returns a copy of all profiles.
func (s *Store) List() []Profile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Profile, len(s.data.Profiles))
	copy(result, s.data.Profiles)
	return result
}

// Get returns a copy of the profile with the given id.
func (s *Store) Get(id string) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == id {
			p := s.data.Profiles[i]
			return &p, nil
		}
	}
	return nil, fmt.Errorf("profile %q not found", id)
}

// ActiveProfile returns the currently active profile, or nil if none exist.
func (s *Store) ActiveProfile() (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.data.Profiles) == 0 {
		return nil, nil
	}
	id := s.data.ActiveProfileID
	if id == "" {
		p := s.data.Profiles[0]
		return &p, nil
	}
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == id {
			p := s.data.Profiles[i]
			return &p, nil
		}
	}
	return nil, nil
}

// ActiveProfileID returns the active profile ID.
func (s *Store) ActiveProfileID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.ActiveProfileID
}

// Create adds a new profile. Assigns a UUID if ID is empty.
func (s *Store) Create(p Profile) (Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.Brokers == nil {
		p.Brokers = []Broker{}
	}
	s.data.Profiles = append(s.data.Profiles, p)
	if s.data.ActiveProfileID == "" {
		s.data.ActiveProfileID = p.ID
	}
	return p, s.save()
}

// Update replaces the profile with matching ID.
func (s *Store) Update(p Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == p.ID {
			s.data.Profiles[i] = p
			return s.save()
		}
	}
	return fmt.Errorf("profile %q not found", p.ID)
}

// Delete removes a profile. If it was active, promotes the next profile.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, p := range s.data.Profiles {
		if p.ID == id {
			s.data.Profiles = append(s.data.Profiles[:i], s.data.Profiles[i+1:]...)
			if s.data.ActiveProfileID == id {
				s.data.ActiveProfileID = ""
				if len(s.data.Profiles) > 0 {
					s.data.ActiveProfileID = s.data.Profiles[0].ID
				}
			}
			return s.save()
		}
	}
	return fmt.Errorf("profile %q not found", id)
}

// SetActive marks the given profile as active.
func (s *Store) SetActive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.data.Profiles {
		if p.ID == id {
			s.data.ActiveProfileID = id
			return s.save()
		}
	}
	return fmt.Errorf("profile %q not found", id)
}

// AddBroker appends a broker to the profile. Assigns a UUID if broker ID is empty.
func (s *Store) AddBroker(profileID string, b Broker) (Broker, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	if b.Addresses == nil {
		b.Addresses = []string{}
	}
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			s.data.Profiles[i].Brokers = append(s.data.Profiles[i].Brokers, b)
			return b, s.save()
		}
	}
	return Broker{}, fmt.Errorf("profile %q not found", profileID)
}

// UpdateBroker replaces a broker within a profile.
func (s *Store) UpdateBroker(profileID string, b Broker) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			for j := range s.data.Profiles[i].Brokers {
				if s.data.Profiles[i].Brokers[j].ID == b.ID {
					s.data.Profiles[i].Brokers[j] = b
					return s.save()
				}
			}
			return fmt.Errorf("broker %q not found in profile %q", b.ID, profileID)
		}
	}
	return fmt.Errorf("profile %q not found", profileID)
}

// AddBrokerCredential appends a named credential to a broker. Assigns a UUID if ID is empty.
func (s *Store) AddBrokerCredential(profileID, brokerID string, c NamedCredential) (NamedCredential, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			for j := range s.data.Profiles[i].Brokers {
				if s.data.Profiles[i].Brokers[j].ID == brokerID {
					s.data.Profiles[i].Brokers[j].Credentials = append(
						s.data.Profiles[i].Brokers[j].Credentials, c,
					)
					return c, s.save()
				}
			}
			return NamedCredential{}, fmt.Errorf("broker %q not found in profile %q", brokerID, profileID)
		}
	}
	return NamedCredential{}, fmt.Errorf("profile %q not found", profileID)
}

// DeleteBrokerCredential removes a named credential from a broker.
func (s *Store) DeleteBrokerCredential(profileID, brokerID, credentialID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			for j := range s.data.Profiles[i].Brokers {
				if s.data.Profiles[i].Brokers[j].ID == brokerID {
					creds := s.data.Profiles[i].Brokers[j].Credentials
					for k, c := range creds {
						if c.ID == credentialID {
							s.data.Profiles[i].Brokers[j].Credentials = append(creds[:k], creds[k+1:]...)
							if s.data.Profiles[i].Brokers[j].ActiveCredentialID == credentialID {
								s.data.Profiles[i].Brokers[j].ActiveCredentialID = ""
							}
							return s.save()
						}
					}
					return fmt.Errorf("credential %q not found", credentialID)
				}
			}
			return fmt.Errorf("broker %q not found in profile %q", brokerID, profileID)
		}
	}
	return fmt.Errorf("profile %q not found", profileID)
}

// SetActiveBrokerCredential sets the active credential ID for a broker.
func (s *Store) SetActiveBrokerCredential(profileID, brokerID, credentialID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			for j := range s.data.Profiles[i].Brokers {
				if s.data.Profiles[i].Brokers[j].ID == brokerID {
					// validate credentialID exists
					found := false
					for _, c := range s.data.Profiles[i].Brokers[j].Credentials {
						if c.ID == credentialID {
							found = true
							break
						}
					}
					if !found {
						return fmt.Errorf("credential %q not found", credentialID)
					}
					s.data.Profiles[i].Brokers[j].ActiveCredentialID = credentialID
					return s.save()
				}
			}
			return fmt.Errorf("broker %q not found in profile %q", brokerID, profileID)
		}
	}
	return fmt.Errorf("profile %q not found", profileID)
}

// DeleteBroker removes a broker from a profile.
func (s *Store) DeleteBroker(profileID, brokerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Profiles {
		if s.data.Profiles[i].ID == profileID {
			brokers := s.data.Profiles[i].Brokers
			for j, b := range brokers {
				if b.ID == brokerID {
					s.data.Profiles[i].Brokers = append(brokers[:j], brokers[j+1:]...)
					return s.save()
				}
			}
			return fmt.Errorf("broker %q not found in profile %q", brokerID, profileID)
		}
	}
	return fmt.Errorf("profile %q not found", profileID)
}
