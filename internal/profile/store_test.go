package profile

import (
	"errors"
	"path/filepath"
	"testing"

	"kafkalet/internal/apperr"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	return &Store{path: filepath.Join(dir, "profiles.json")}
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

func TestCreateAndList(t *testing.T) {
	s := testStore(t)

	p, err := s.Create(Profile{Name: "dev"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if p.ID == "" {
		t.Fatal("expected non-empty ID after Create")
	}
	if p.Name != "dev" {
		t.Fatalf("expected name %q, got %q", "dev", p.Name)
	}

	list := s.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 profile in list, got %d", len(list))
	}
	if list[0].ID != p.ID {
		t.Fatalf("list[0].ID = %q, want %q", list[0].ID, p.ID)
	}
}

func TestCreateEmptyName(t *testing.T) {
	s := testStore(t)

	for _, name := range []string{"", "   ", "\t"} {
		_, err := s.Create(Profile{Name: name})
		if err == nil {
			t.Fatalf("expected error for name %q, got nil", name)
		}
		if !errors.Is(err, apperr.ErrValidation) {
			t.Fatalf("expected ErrValidation for name %q, got %v", name, err)
		}
	}
}

func TestCreateSetsActive(t *testing.T) {
	s := testStore(t)

	p1, err := s.Create(Profile{Name: "first"})
	if err != nil {
		t.Fatalf("Create first: %v", err)
	}
	if s.ActiveProfileID() != p1.ID {
		t.Fatalf("active should be %q after first create, got %q", p1.ID, s.ActiveProfileID())
	}

	// Second profile should NOT change active.
	_, err = s.Create(Profile{Name: "second"})
	if err != nil {
		t.Fatalf("Create second: %v", err)
	}
	if s.ActiveProfileID() != p1.ID {
		t.Fatalf("active should still be %q, got %q", p1.ID, s.ActiveProfileID())
	}
}

func TestCreateTrimsName(t *testing.T) {
	s := testStore(t)

	p, err := s.Create(Profile{Name: "  staging  "})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if p.Name != "staging" {
		t.Fatalf("expected trimmed name %q, got %q", "staging", p.Name)
	}
}

func TestCreateInitializesBrokersSlice(t *testing.T) {
	s := testStore(t)

	p, err := s.Create(Profile{Name: "empty"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if p.Brokers == nil {
		t.Fatal("expected non-nil Brokers slice")
	}
	if len(p.Brokers) != 0 {
		t.Fatalf("expected 0 brokers, got %d", len(p.Brokers))
	}
}

func TestGetNotFound(t *testing.T) {
	s := testStore(t)

	_, err := s.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestGetReturnsProfile(t *testing.T) {
	s := testStore(t)

	created, _ := s.Create(Profile{Name: "prod"})

	got, err := s.Get(created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "prod" {
		t.Fatalf("Get name = %q, want %q", got.Name, "prod")
	}
}

func TestUpdate(t *testing.T) {
	s := testStore(t)

	p, _ := s.Create(Profile{Name: "old"})
	p.Name = "new"
	if err := s.Update(p); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, err := s.Get(p.ID)
	if err != nil {
		t.Fatalf("Get after update: %v", err)
	}
	if got.Name != "new" {
		t.Fatalf("expected updated name %q, got %q", "new", got.Name)
	}
}

func TestUpdateNotFound(t *testing.T) {
	s := testStore(t)

	err := s.Update(Profile{ID: "missing", Name: "x"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestDelete(t *testing.T) {
	s := testStore(t)

	p, _ := s.Create(Profile{Name: "temp"})
	if err := s.Delete(p.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	list := s.List()
	if len(list) != 0 {
		t.Fatalf("expected 0 profiles after delete, got %d", len(list))
	}
}

func TestDeleteNotFound(t *testing.T) {
	s := testStore(t)

	err := s.Delete("nope")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestDeletePromotesActive(t *testing.T) {
	s := testStore(t)

	p1, _ := s.Create(Profile{Name: "first"})
	p2, _ := s.Create(Profile{Name: "second"})

	// p1 is active (first created).
	if s.ActiveProfileID() != p1.ID {
		t.Fatalf("expected active = %q, got %q", p1.ID, s.ActiveProfileID())
	}

	if err := s.Delete(p1.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	if s.ActiveProfileID() != p2.ID {
		t.Fatalf("expected promoted active = %q, got %q", p2.ID, s.ActiveProfileID())
	}
}

func TestDeleteLastProfileClearsActive(t *testing.T) {
	s := testStore(t)

	p, _ := s.Create(Profile{Name: "only"})
	if err := s.Delete(p.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if s.ActiveProfileID() != "" {
		t.Fatalf("expected empty active after deleting last, got %q", s.ActiveProfileID())
	}
}

func TestSetActive(t *testing.T) {
	s := testStore(t)

	p1, _ := s.Create(Profile{Name: "first"})
	p2, _ := s.Create(Profile{Name: "second"})

	if err := s.SetActive(p2.ID); err != nil {
		t.Fatalf("SetActive: %v", err)
	}
	if s.ActiveProfileID() != p2.ID {
		t.Fatalf("expected active = %q, got %q", p2.ID, s.ActiveProfileID())
	}

	// Switch back.
	if err := s.SetActive(p1.ID); err != nil {
		t.Fatalf("SetActive back: %v", err)
	}
	if s.ActiveProfileID() != p1.ID {
		t.Fatalf("expected active = %q, got %q", p1.ID, s.ActiveProfileID())
	}
}

func TestSetActiveNotFound(t *testing.T) {
	s := testStore(t)

	err := s.SetActive("ghost")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestActiveProfileReturnsFirst(t *testing.T) {
	s := testStore(t)

	// No profiles: nil, nil.
	ap, err := s.ActiveProfile()
	if err != nil {
		t.Fatalf("ActiveProfile empty: %v", err)
	}
	if ap != nil {
		t.Fatal("expected nil active when no profiles exist")
	}

	// Create a profile; force ActiveProfileID to empty to simulate no explicit set.
	p, _ := s.Create(Profile{Name: "fallback"})
	s.mu.Lock()
	s.data.ActiveProfileID = ""
	s.mu.Unlock()

	ap, err = s.ActiveProfile()
	if err != nil {
		t.Fatalf("ActiveProfile: %v", err)
	}
	if ap == nil {
		t.Fatal("expected non-nil active")
	}
	if ap.ID != p.ID {
		t.Fatalf("expected first profile %q, got %q", p.ID, ap.ID)
	}
}

func TestActiveProfileReturnsExplicit(t *testing.T) {
	s := testStore(t)

	_, _ = s.Create(Profile{Name: "first"})
	p2, _ := s.Create(Profile{Name: "second"})
	_ = s.SetActive(p2.ID)

	ap, err := s.ActiveProfile()
	if err != nil {
		t.Fatalf("ActiveProfile: %v", err)
	}
	if ap.ID != p2.ID {
		t.Fatalf("expected active %q, got %q", p2.ID, ap.ID)
	}
}

// ---------------------------------------------------------------------------
// Persistence across reload
// ---------------------------------------------------------------------------

func TestPersistence(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "profiles.json")

	s1 := &Store{path: path}
	_, err := s1.Create(Profile{Name: "persist"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Simulate restart: new store loading same file.
	s2 := &Store{path: path}
	if err := s2.load(); err != nil {
		t.Fatalf("load: %v", err)
	}

	list := s2.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 profile after reload, got %d", len(list))
	}
	if list[0].Name != "persist" {
		t.Fatalf("expected name %q, got %q", "persist", list[0].Name)
	}
}

// ---------------------------------------------------------------------------
// Broker CRUD
// ---------------------------------------------------------------------------

func TestAddBroker(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	b, err := s.AddBroker(p.ID, Broker{Name: "local", Addresses: []string{"localhost:9092"}})
	if err != nil {
		t.Fatalf("AddBroker: %v", err)
	}
	if b.ID == "" {
		t.Fatal("expected non-empty broker ID")
	}
	if b.Name != "local" {
		t.Fatalf("broker name = %q, want %q", b.Name, "local")
	}

	got, _ := s.Get(p.ID)
	if len(got.Brokers) != 1 {
		t.Fatalf("expected 1 broker, got %d", len(got.Brokers))
	}
	if got.Brokers[0].ID != b.ID {
		t.Fatalf("broker ID mismatch: %q vs %q", got.Brokers[0].ID, b.ID)
	}
}

func TestAddBrokerEmptyName(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	_, err := s.AddBroker(p.ID, Broker{Name: ""})
	if err == nil {
		t.Fatal("expected error for empty broker name")
	}
	if !errors.Is(err, apperr.ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestAddBrokerProfileNotFound(t *testing.T) {
	s := testStore(t)

	_, err := s.AddBroker("missing", Broker{Name: "x"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestAddBrokerTrimsName(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	b, err := s.AddBroker(p.ID, Broker{Name: "  kafka  "})
	if err != nil {
		t.Fatalf("AddBroker: %v", err)
	}
	if b.Name != "kafka" {
		t.Fatalf("expected trimmed name %q, got %q", "kafka", b.Name)
	}
}

func TestAddBrokerInitializesAddresses(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	b, err := s.AddBroker(p.ID, Broker{Name: "no-addrs"})
	if err != nil {
		t.Fatalf("AddBroker: %v", err)
	}
	if b.Addresses == nil {
		t.Fatal("expected non-nil Addresses slice")
	}
}

func TestUpdateBroker(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "old"})

	b.Name = "new"
	if err := s.UpdateBroker(p.ID, b); err != nil {
		t.Fatalf("UpdateBroker: %v", err)
	}

	got, _ := s.Get(p.ID)
	if got.Brokers[0].Name != "new" {
		t.Fatalf("expected updated broker name %q, got %q", "new", got.Brokers[0].Name)
	}
}

func TestUpdateBrokerNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	err := s.UpdateBroker(p.ID, Broker{ID: "missing", Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}

	err = s.UpdateBroker("missing", Broker{ID: "x", Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

func TestDeleteBroker(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "rm-me"})

	if err := s.DeleteBroker(p.ID, b.ID); err != nil {
		t.Fatalf("DeleteBroker: %v", err)
	}

	got, _ := s.Get(p.ID)
	if len(got.Brokers) != 0 {
		t.Fatalf("expected 0 brokers after delete, got %d", len(got.Brokers))
	}
}

func TestDeleteBrokerNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	err := s.DeleteBroker(p.ID, "nope")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}

	err = s.DeleteBroker("missing", "nope")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Credential CRUD
// ---------------------------------------------------------------------------

func TestCredentialCRUD(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	// Add credential.
	cred, err := s.AddBrokerCredential(p.ID, b.ID, NamedCredential{
		Name: "admin",
		SASL: SASLConfig{Mechanism: "PLAIN", Username: "admin"},
	})
	if err != nil {
		t.Fatalf("AddBrokerCredential: %v", err)
	}
	if cred.ID == "" {
		t.Fatal("expected non-empty credential ID")
	}

	// Verify credential is on the broker.
	got, _ := s.Get(p.ID)
	if len(got.Brokers[0].Credentials) != 1 {
		t.Fatalf("expected 1 credential, got %d", len(got.Brokers[0].Credentials))
	}

	// Set active credential.
	if err := s.SetActiveBrokerCredential(p.ID, b.ID, cred.ID); err != nil {
		t.Fatalf("SetActiveBrokerCredential: %v", err)
	}
	got, _ = s.Get(p.ID)
	if got.Brokers[0].ActiveCredentialID != cred.ID {
		t.Fatalf("active cred = %q, want %q", got.Brokers[0].ActiveCredentialID, cred.ID)
	}

	// Delete credential should clear ActiveCredentialID.
	if err := s.DeleteBrokerCredential(p.ID, b.ID, cred.ID); err != nil {
		t.Fatalf("DeleteBrokerCredential: %v", err)
	}
	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].Credentials) != 0 {
		t.Fatalf("expected 0 credentials after delete, got %d", len(got.Brokers[0].Credentials))
	}
	if got.Brokers[0].ActiveCredentialID != "" {
		t.Fatalf("expected empty ActiveCredentialID after deleting active cred, got %q", got.Brokers[0].ActiveCredentialID)
	}
}

func TestAddCredentialNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	// Missing broker.
	_, err := s.AddBrokerCredential(p.ID, "missing-broker", NamedCredential{Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing broker, got %v", err)
	}

	// Missing profile.
	_, err = s.AddBrokerCredential("missing-profile", "b", NamedCredential{Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

func TestDeleteCredentialNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	err := s.DeleteBrokerCredential(p.ID, b.ID, "no-such-cred")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestSetActiveCredentialNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	err := s.SetActiveBrokerCredential(p.ID, b.ID, "ghost")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestDeleteCredentialDoesNotClearOtherActive(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	c1, _ := s.AddBrokerCredential(p.ID, b.ID, NamedCredential{Name: "one"})
	c2, _ := s.AddBrokerCredential(p.ID, b.ID, NamedCredential{Name: "two"})

	_ = s.SetActiveBrokerCredential(p.ID, b.ID, c1.ID)

	// Delete c2 (not the active one).
	if err := s.DeleteBrokerCredential(p.ID, b.ID, c2.ID); err != nil {
		t.Fatalf("DeleteBrokerCredential: %v", err)
	}

	got, _ := s.Get(p.ID)
	if got.Brokers[0].ActiveCredentialID != c1.ID {
		t.Fatalf("deleting non-active cred changed active: got %q, want %q", got.Brokers[0].ActiveCredentialID, c1.ID)
	}
}

func TestClearActiveBrokerCredential(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})
	c, _ := s.AddBrokerCredential(p.ID, b.ID, NamedCredential{Name: "admin"})
	_ = s.SetActiveBrokerCredential(p.ID, b.ID, c.ID)

	if err := s.ClearActiveBrokerCredential(p.ID, b.ID); err != nil {
		t.Fatalf("ClearActiveBrokerCredential: %v", err)
	}

	got, _ := s.Get(p.ID)
	if got.Brokers[0].ActiveCredentialID != "" {
		t.Fatalf("expected empty ActiveCredentialID, got %q", got.Brokers[0].ActiveCredentialID)
	}
}

// ---------------------------------------------------------------------------
// Pin / Unpin
// ---------------------------------------------------------------------------

func TestPinUnpinTopic(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	// Pin a topic.
	if err := s.PinTopic(p.ID, b.ID, "orders"); err != nil {
		t.Fatalf("PinTopic: %v", err)
	}
	got, _ := s.Get(p.ID)
	if len(got.Brokers[0].PinnedTopics) != 1 || got.Brokers[0].PinnedTopics[0] != "orders" {
		t.Fatalf("expected [orders], got %v", got.Brokers[0].PinnedTopics)
	}

	// Pin same topic again (idempotent).
	if err := s.PinTopic(p.ID, b.ID, "orders"); err != nil {
		t.Fatalf("PinTopic idempotent: %v", err)
	}
	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].PinnedTopics) != 1 {
		t.Fatalf("expected 1 pinned after duplicate pin, got %d", len(got.Brokers[0].PinnedTopics))
	}

	// Pin a second topic.
	if err := s.PinTopic(p.ID, b.ID, "payments"); err != nil {
		t.Fatalf("PinTopic second: %v", err)
	}
	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].PinnedTopics) != 2 {
		t.Fatalf("expected 2 pinned, got %d", len(got.Brokers[0].PinnedTopics))
	}

	// Unpin.
	if err := s.UnpinTopic(p.ID, b.ID, "orders"); err != nil {
		t.Fatalf("UnpinTopic: %v", err)
	}
	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].PinnedTopics) != 1 || got.Brokers[0].PinnedTopics[0] != "payments" {
		t.Fatalf("expected [payments], got %v", got.Brokers[0].PinnedTopics)
	}

	// Unpin something not pinned (no-op, no error).
	if err := s.UnpinTopic(p.ID, b.ID, "orders"); err != nil {
		t.Fatalf("UnpinTopic no-op: %v", err)
	}
}

func TestPinTopicNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	err := s.PinTopic(p.ID, "missing", "t")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing broker, got %v", err)
	}

	err = s.PinTopic("missing", "b", "t")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

func TestUnpinTopicNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	err := s.UnpinTopic(p.ID, "missing", "t")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing broker, got %v", err)
	}

	err = s.UnpinTopic("missing", "b", "t")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Topic Group CRUD
// ---------------------------------------------------------------------------

func TestTopicGroupCRUD(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	// Save (create) a topic group.
	g := TopicGroup{Name: "important", Topics: []string{"orders", "payments"}}
	if err := s.SaveTopicGroup(p.ID, b.ID, g); err != nil {
		t.Fatalf("SaveTopicGroup create: %v", err)
	}

	got, _ := s.Get(p.ID)
	if len(got.Brokers[0].TopicGroups) != 1 {
		t.Fatalf("expected 1 topic group, got %d", len(got.Brokers[0].TopicGroups))
	}
	savedGroup := got.Brokers[0].TopicGroups[0]
	if savedGroup.ID == "" {
		t.Fatal("expected non-empty topic group ID")
	}
	if savedGroup.Name != "important" {
		t.Fatalf("group name = %q, want %q", savedGroup.Name, "important")
	}
	if len(savedGroup.Topics) != 2 {
		t.Fatalf("expected 2 topics, got %d", len(savedGroup.Topics))
	}

	// Save (update/upsert) the same group by ID.
	savedGroup.Name = "critical"
	savedGroup.Topics = []string{"orders"}
	if err := s.SaveTopicGroup(p.ID, b.ID, savedGroup); err != nil {
		t.Fatalf("SaveTopicGroup update: %v", err)
	}

	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].TopicGroups) != 1 {
		t.Fatalf("expected 1 group after upsert, got %d", len(got.Brokers[0].TopicGroups))
	}
	if got.Brokers[0].TopicGroups[0].Name != "critical" {
		t.Fatalf("expected updated name %q, got %q", "critical", got.Brokers[0].TopicGroups[0].Name)
	}
	if len(got.Brokers[0].TopicGroups[0].Topics) != 1 {
		t.Fatalf("expected 1 topic after upsert, got %d", len(got.Brokers[0].TopicGroups[0].Topics))
	}

	// Delete the topic group.
	if err := s.DeleteTopicGroup(p.ID, b.ID, savedGroup.ID); err != nil {
		t.Fatalf("DeleteTopicGroup: %v", err)
	}

	got, _ = s.Get(p.ID)
	if len(got.Brokers[0].TopicGroups) != 0 {
		t.Fatalf("expected 0 groups after delete, got %d", len(got.Brokers[0].TopicGroups))
	}
}

func TestSaveTopicGroupNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	err := s.SaveTopicGroup(p.ID, "missing", TopicGroup{Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing broker, got %v", err)
	}

	err = s.SaveTopicGroup("missing", "b", TopicGroup{Name: "x"})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing profile, got %v", err)
	}
}

func TestDeleteTopicGroupNotFound(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})
	b, _ := s.AddBroker(p.ID, Broker{Name: "kafka"})

	err := s.DeleteTopicGroup(p.ID, b.ID, "nope")
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

func TestListReturnsCopy(t *testing.T) {
	s := testStore(t)
	_, _ = s.Create(Profile{Name: "dev"})

	list := s.List()
	list[0].Name = "mutated"

	fresh := s.List()
	if fresh[0].Name == "mutated" {
		t.Fatal("List returned a reference, not a copy")
	}
}

func TestGetReturnsCopy(t *testing.T) {
	s := testStore(t)
	p, _ := s.Create(Profile{Name: "dev"})

	got, _ := s.Get(p.ID)
	got.Name = "mutated"

	fresh, _ := s.Get(p.ID)
	if fresh.Name == "mutated" {
		t.Fatal("Get returned a reference, not a copy")
	}
}

func TestLoadNonexistentFile(t *testing.T) {
	s := testStore(t)

	// load() on a nonexistent file should succeed with empty data.
	if err := s.load(); err != nil {
		t.Fatalf("load nonexistent: %v", err)
	}
	if len(s.data.Profiles) != 0 {
		t.Fatalf("expected 0 profiles, got %d", len(s.data.Profiles))
	}
}
