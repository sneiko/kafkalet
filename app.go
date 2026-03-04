package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"kafkalet/internal/broker"
	"kafkalet/internal/plugin"
	"kafkalet/internal/profile"
	"kafkalet/internal/schema"
	"kafkalet/internal/stream"
)

// App is the Wails-bound struct. All public methods become frontend RPCs.
// Keep methods thin — delegate to internal/ packages.
type App struct {
	ctx          context.Context
	profileStore *profile.Store
	pluginStore  *plugin.Store
	streamMgr    *stream.Manager

	rateWatchCancel context.CancelFunc
	rateWatchMu     sync.Mutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	store, err := profile.NewStore()
	if err != nil {
		slog.Error("failed to init profile store", "err", err)
		return
	}
	a.profileStore = store

	a.pluginStore = plugin.NewStore()

	a.streamMgr = stream.NewManager(ctx, func(name string, data any) {
		runtime.EventsEmit(ctx, name, data)
	})
}

// ── Plugin management ─────────────────────────────────────────────────────────

// ListPlugins returns all saved message decoder plugins.
func (a *App) ListPlugins() ([]plugin.Plugin, error) {
	return a.pluginStore.List()
}

// SavePlugin creates or updates a plugin. Returns the saved plugin with its ID.
func (a *App) SavePlugin(p plugin.Plugin) (plugin.Plugin, error) {
	return a.pluginStore.Save(p)
}

// DeletePlugin removes a plugin by ID.
func (a *App) DeletePlugin(pluginID string) error {
	return a.pluginStore.Delete(pluginID)
}

// ── Profile management ────────────────────────────────────────────────────────

func (a *App) ListProfiles() ([]profile.Profile, error) {
	return a.profileStore.List(), nil
}

func (a *App) GetActiveProfile() (*profile.Profile, error) {
	return a.profileStore.ActiveProfile()
}

func (a *App) CreateProfile(name string) (profile.Profile, error) {
	return a.profileStore.Create(profile.Profile{Name: name})
}

func (a *App) UpdateProfile(p profile.Profile) error {
	return a.profileStore.Update(p)
}

func (a *App) DeleteProfile(id string) error {
	if p, err := a.profileStore.Get(id); err == nil {
		for _, b := range p.Brokers {
			_ = profile.DeletePassword(id, b.ID)
			_ = profile.DeleteSchemaRegistryPassword(id, b.ID)
		}
	}
	return a.profileStore.Delete(id)
}

// ── Export/Import structures ──────────────────────────────────────────────────

type exportSettings struct {
	Profiles []exportProfile `json:"profiles"`
}

type exportProfile struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Brokers []exportBroker `json:"brokers"`
}

type exportBroker struct {
	ID                     string                       `json:"id"`
	Name                   string                       `json:"name"`
	Addresses              []string                     `json:"addresses"`
	SASL                   profile.SASLConfig           `json:"sasl"`
	TLS                    profile.TLSConfig            `json:"tls"`
	SchemaRegistry         profile.SchemaRegistryConfig `json:"schemaRegistry"`
	ActiveCredentialID     string                       `json:"activeCredentialID,omitempty"`
	SASLPassword           string                       `json:"saslPassword,omitempty"`
	SchemaRegistryPassword string                       `json:"schemaRegistryPassword,omitempty"`
	Credentials            []exportCredential           `json:"credentials,omitempty"`
}

type exportCredential struct {
	ID       string             `json:"id"`
	Name     string             `json:"name"`
	SASL     profile.SASLConfig `json:"sasl"`
	Password string             `json:"password,omitempty"`
}

// ExportSettings saves all profiles including passwords to a user-chosen JSON file.
func (a *App) ExportSettings() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: "kafkalet-backup.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil || path == "" {
		return err
	}

	profiles := a.profileStore.List()
	export := exportSettings{Profiles: make([]exportProfile, 0, len(profiles))}

	for _, p := range profiles {
		ep := exportProfile{ID: p.ID, Name: p.Name, Brokers: make([]exportBroker, 0, len(p.Brokers))}
		for _, b := range p.Brokers {
			eb := exportBroker{
				ID:                 b.ID,
				Name:               b.Name,
				Addresses:          b.Addresses,
				SASL:               b.SASL,
				TLS:                b.TLS,
				SchemaRegistry:     b.SchemaRegistry,
				ActiveCredentialID: b.ActiveCredentialID,
			}
			eb.SASLPassword, _ = profile.GetPassword(p.ID, b.ID)
			eb.SchemaRegistryPassword, _ = profile.GetSchemaRegistryPassword(p.ID, b.ID)
			for _, cred := range b.Credentials {
				ec := exportCredential{ID: cred.ID, Name: cred.Name, SASL: cred.SASL}
				ec.Password, _ = profile.GetNamedCredentialPassword(p.ID, b.ID, cred.ID)
				eb.Credentials = append(eb.Credentials, ec)
			}
			ep.Brokers = append(ep.Brokers, eb)
		}
		export.Profiles = append(export.Profiles, ep)
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	return os.WriteFile(path, data, 0o600)
}

// ImportSettings reads profiles from a user-chosen JSON file and merges them
// (adds profiles not already present by ID), restoring passwords to keychain.
// Emits "profiles:imported" on success.
func (a *App) ImportSettings() error {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil || path == "" {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	var imported exportSettings
	if err := json.Unmarshal(data, &imported); err != nil {
		return fmt.Errorf("parse settings: %w", err)
	}

	existing := a.profileStore.List()
	existingIDs := make(map[string]bool, len(existing))
	for _, p := range existing {
		existingIDs[p.ID] = true
	}

	for _, ep := range imported.Profiles {
		if existingIDs[ep.ID] {
			continue
		}
		newProfile := profile.Profile{ID: ep.ID, Name: ep.Name, Brokers: make([]profile.Broker, 0, len(ep.Brokers))}
		for _, eb := range ep.Brokers {
			b := profile.Broker{
				ID:                 eb.ID,
				Name:               eb.Name,
				Addresses:          eb.Addresses,
				SASL:               eb.SASL,
				TLS:                eb.TLS,
				SchemaRegistry:     eb.SchemaRegistry,
				ActiveCredentialID: eb.ActiveCredentialID,
			}
			for _, ec := range eb.Credentials {
				b.Credentials = append(b.Credentials, profile.NamedCredential{
					ID: ec.ID, Name: ec.Name, SASL: ec.SASL,
				})
			}
			newProfile.Brokers = append(newProfile.Brokers, b)
		}
		if _, err := a.profileStore.Create(newProfile); err != nil {
			slog.Warn("import profile failed", "id", ep.ID, "err", err)
			continue
		}
		// Restore passwords to keychain
		for _, eb := range ep.Brokers {
			if eb.SASLPassword != "" {
				_ = profile.SavePassword(ep.ID, eb.ID, eb.SASLPassword)
			}
			if eb.SchemaRegistryPassword != "" {
				_ = profile.SaveSchemaRegistryPassword(ep.ID, eb.ID, eb.SchemaRegistryPassword)
			}
			for _, ec := range eb.Credentials {
				if ec.Password != "" {
					_ = profile.SaveNamedCredentialPassword(ep.ID, eb.ID, ec.ID, ec.Password)
				}
			}
		}
	}
	runtime.EventsEmit(a.ctx, "profiles:imported", nil)
	return nil
}

// RenameProfile updates only the name of a profile.
func (a *App) RenameProfile(id, name string) error {
	p, err := a.profileStore.Get(id)
	if err != nil {
		return err
	}
	p.Name = name
	return a.profileStore.Update(*p)
}

// SwitchProfile stops all active stream sessions, switches the active profile
// and notifies the frontend.
func (a *App) SwitchProfile(id string) error {
	a.streamMgr.StopAll()

	if err := a.profileStore.SetActive(id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "profile:switched", id)
	return nil
}

// ── Broker management ─────────────────────────────────────────────────────────

func (a *App) AddBroker(profileID string, b profile.Broker) (profile.Broker, error) {
	return a.profileStore.AddBroker(profileID, b)
}

func (a *App) UpdateBroker(profileID string, b profile.Broker) error {
	return a.profileStore.UpdateBroker(profileID, b)
}

func (a *App) DeleteBroker(profileID, brokerID string) error {
	if err := profile.DeletePassword(profileID, brokerID); err != nil {
		runtime.LogWarningf(a.ctx, "delete broker password: %v", err)
	}
	return a.profileStore.DeleteBroker(profileID, brokerID)
}

func (a *App) SetBrokerPassword(profileID, brokerID, password string) error {
	return profile.SavePassword(profileID, brokerID, password)
}

// SetSchemaRegistryPassword stores the Schema Registry HTTP Basic password in the OS keychain.
func (a *App) SetSchemaRegistryPassword(profileID, brokerID, password string) error {
	return profile.SaveSchemaRegistryPassword(profileID, brokerID, password)
}

// AddBrokerCredential adds a named credential to a broker.
func (a *App) AddBrokerCredential(profileID, brokerID string, cred profile.NamedCredential) (profile.NamedCredential, error) {
	return a.profileStore.AddBrokerCredential(profileID, brokerID, cred)
}

// SetNamedCredentialPassword stores a named credential password in the OS keychain.
func (a *App) SetNamedCredentialPassword(profileID, brokerID, credentialID, password string) error {
	return profile.SaveNamedCredentialPassword(profileID, brokerID, credentialID, password)
}

// DeleteBrokerCredential removes a named credential from a broker and deletes its keychain entry.
func (a *App) DeleteBrokerCredential(profileID, brokerID, credentialID string) error {
	_ = profile.DeleteNamedCredentialPassword(profileID, brokerID, credentialID)
	return a.profileStore.DeleteBrokerCredential(profileID, brokerID, credentialID)
}

// SwitchBrokerCredential stops all sessions for a broker, sets the active credential, and emits an event.
func (a *App) SwitchBrokerCredential(profileID, brokerID, credentialID string) error {
	a.streamMgr.StopBroker(brokerID)
	if err := a.profileStore.SetActiveBrokerCredential(profileID, brokerID, credentialID); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "broker:credential-switched", map[string]string{
		"profileID":    profileID,
		"brokerID":     brokerID,
		"credentialID": credentialID,
	})
	return nil
}

// TestBrokerConnection fetches the password from the keychain and sends an
// ApiVersions request to verify the broker is reachable.
func (a *App) TestBrokerConnection(profileID, brokerID string) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.TestConnection(a.ctx, *b, password)
}

// ── Broker metadata ───────────────────────────────────────────────────────────

// ListTopics fetches all topics with partition counts from the given broker.
func (a *App) ListTopics(profileID, brokerID string) ([]broker.Topic, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return nil, fmt.Errorf("get password: %w", err)
	}
	return broker.ListTopics(a.ctx, *b, password)
}

// ── Producer ──────────────────────────────────────────────────────────────────

// ProduceMessage produces a single message to a Kafka topic synchronously.
func (a *App) ProduceMessage(profileID, brokerID string, req broker.ProduceRequest) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.ProduceMessage(a.ctx, *b, password, req)
}

// GetTopicMetadata returns partition details (leader, replicas, ISR) for a topic.
func (a *App) GetTopicMetadata(profileID, brokerID, topic string) (broker.TopicMetadata, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return broker.TopicMetadata{}, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return broker.TopicMetadata{}, fmt.Errorf("get password: %w", err)
	}
	return broker.GetTopicMetadata(a.ctx, *b, password, topic)
}

// ResetConsumerGroup commits new offsets for a consumer group on a topic.
// offset: "earliest" | "latest" | unix milliseconds as string.
func (a *App) ResetConsumerGroup(profileID, brokerID, topic, groupID, offset string) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.ResetConsumerGroup(a.ctx, *b, password, topic, groupID, offset)
}

// ListConsumerGroups returns lag metrics for all consumer groups on a topic.
func (a *App) ListConsumerGroups(profileID, brokerID, topic string) ([]broker.GroupLag, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return nil, fmt.Errorf("get password: %w", err)
	}
	return broker.ListConsumerGroupsForTopic(a.ctx, *b, password, topic)
}

// GetClusterInfo returns the cluster ID, controller node ID, and broker list.
func (a *App) GetClusterInfo(profileID, brokerID string) (broker.ClusterInfo, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return broker.ClusterInfo{}, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return broker.ClusterInfo{}, fmt.Errorf("get password: %w", err)
	}
	return broker.GetClusterInfo(a.ctx, *b, password)
}

// StartObserverAtTimestamp resolves partition offsets at the given Unix
// millisecond timestamp and starts an observer session from those offsets.
func (a *App) StartObserverAtTimestamp(profileID, brokerID, topic string, timestampMs int64) (string, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return "", err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return "", fmt.Errorf("get password: %w", err)
	}
	partitionOffsets, err := broker.GetOffsetsAtTimestamp(a.ctx, *b, password, topic, timestampMs)
	if err != nil {
		return "", fmt.Errorf("resolve timestamp offsets: %w", err)
	}
	return a.streamMgr.StartObserver(*b, password, topic, stream.ObserverOpts{
		PartitionOffsets: partitionOffsets,
		Registry:         a.buildSchemaRegistry(profileID, b),
	})
}

// ── Topic management ──────────────────────────────────────────────────────────

// CreateTopic creates a new topic on the given broker.
func (a *App) CreateTopic(profileID, brokerID string, req broker.CreateTopicRequest) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.CreateTopic(a.ctx, *b, password, req)
}

// DeleteTopic deletes a topic from the given broker.
func (a *App) DeleteTopic(profileID, brokerID, topicName string) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.DeleteTopic(a.ctx, *b, password, topicName)
}

// GetTopicConfig returns the configuration for a topic.
func (a *App) GetTopicConfig(profileID, brokerID, topicName string) ([]broker.TopicConfigEntry, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return nil, fmt.Errorf("get password: %w", err)
	}
	return broker.GetTopicConfig(a.ctx, *b, password, topicName)
}

// AlterTopicConfig updates a single configuration key for a topic.
func (a *App) AlterTopicConfig(profileID, brokerID, topicName, key, value string) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}
	return broker.AlterTopicConfig(a.ctx, *b, password, topicName, key, value)
}

// ── Stream sessions ───────────────────────────────────────────────────────────

// StartObserver starts reading a topic without joining a consumer group.
// startOffset: "latest" (default) | "earliest"
// Returns the session ID to subscribe to "stream:<sessionID>" events.
func (a *App) StartObserver(profileID, brokerID, topic, startOffset string) (string, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return "", err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return "", fmt.Errorf("get password: %w", err)
	}
	return a.streamMgr.StartObserver(*b, password, topic, stream.ObserverOpts{
		StartOffset: startOffset,
		Registry:    a.buildSchemaRegistry(profileID, b),
	})
}

// StartConsumer joins a consumer group and starts reading a topic.
// groupID is the Kafka consumer group name.
// startOffset: "latest" (default) | "earliest" — reset position for new groups.
// Returns the session ID to subscribe to "stream:<sessionID>" events.
func (a *App) StartConsumer(profileID, brokerID, topic, groupID, startOffset string) (string, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return "", err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return "", fmt.Errorf("get password: %w", err)
	}
	return a.streamMgr.StartConsumer(*b, password, topic, stream.ConsumerOpts{
		GroupID:     groupID,
		StartOffset: startOffset,
		Registry:    a.buildSchemaRegistry(profileID, b),
	})
}

// CommitSession commits all pending (marked) offsets for a consumer group session.
func (a *App) CommitSession(sessionID string) error {
	return a.streamMgr.CommitSession(a.ctx, sessionID)
}

// StopSession stops an active stream session.
func (a *App) StopSession(sessionID string) error {
	a.streamMgr.Stop(sessionID)
	return nil
}

// ── Cluster metrics ───────────────────────────────────────────────────────────

// GetClusterStats returns aggregate broker/topic/partition counts plus URP and offline partitions.
func (a *App) GetClusterStats(profileID, brokerID string) (broker.ClusterStats, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return broker.ClusterStats{}, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return broker.ClusterStats{}, fmt.Errorf("get password: %w", err)
	}
	return broker.GetClusterStats(a.ctx, *b, password)
}

// ListAllConsumerGroups returns all consumer groups with state and total lag.
func (a *App) ListAllConsumerGroups(profileID, brokerID string) ([]broker.GroupSummary, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return nil, fmt.Errorf("get password: %w", err)
	}
	return broker.ListAllConsumerGroups(a.ctx, *b, password)
}

// GetConsumerGroupDetail returns per-topic/per-partition lag for a single group.
func (a *App) GetConsumerGroupDetail(profileID, brokerID, groupID string) (broker.GroupDetail, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return broker.GroupDetail{}, err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return broker.GroupDetail{}, fmt.Errorf("get password: %w", err)
	}
	return broker.GetConsumerGroupDetail(a.ctx, *b, password, groupID)
}

// StartRateWatcher starts a goroutine that polls LEO for all topics every 30s
// and emits snapshots on the "rate:<brokerID>" event. Stops any previous watcher.
func (a *App) StartRateWatcher(profileID, brokerID string) error {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return err
	}
	password, err := a.resolvePassword(profileID, brokerID)
	if err != nil {
		return fmt.Errorf("get password: %w", err)
	}

	a.rateWatchMu.Lock()
	defer a.rateWatchMu.Unlock()
	if a.rateWatchCancel != nil {
		a.rateWatchCancel()
	}

	eventName := "rate:" + brokerID
	cancel, err := broker.StartRateWatcher(a.ctx, *b, password, 30, func(snap broker.RateSnapshot) {
		runtime.EventsEmit(a.ctx, eventName, snap)
	})
	if err != nil {
		return err
	}
	a.rateWatchCancel = cancel
	return nil
}

// StopRateWatcher stops the active rate watcher if any.
func (a *App) StopRateWatcher() {
	a.rateWatchMu.Lock()
	defer a.rateWatchMu.Unlock()
	if a.rateWatchCancel != nil {
		a.rateWatchCancel()
		a.rateWatchCancel = nil
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// resolvePassword returns the active password for a broker.
// If the broker has an ActiveCredentialID, returns the named credential password;
// otherwise falls back to the legacy broker-level password.
func (a *App) resolvePassword(profileID, brokerID string) (string, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return "", err
	}
	if b.ActiveCredentialID != "" {
		return profile.GetNamedCredentialPassword(profileID, brokerID, b.ActiveCredentialID)
	}
	return profile.GetPassword(profileID, brokerID)
}

// buildSchemaRegistry creates a *schema.Registry from the broker's SchemaRegistry config.
// Returns nil if the broker has no Schema Registry URL configured.
func (a *App) buildSchemaRegistry(profileID string, b *profile.Broker) *schema.Registry {
	if b.SchemaRegistry.URL == "" {
		return nil
	}
	password, _ := profile.GetSchemaRegistryPassword(profileID, b.ID)
	return schema.New(b.SchemaRegistry.URL, b.SchemaRegistry.Username, password)
}

// findBroker looks up a broker by profileID and brokerID.
func (a *App) findBroker(profileID, brokerID string) (*profile.Broker, error) {
	p, err := a.profileStore.Get(profileID)
	if err != nil {
		return nil, err
	}
	for i := range p.Brokers {
		if p.Brokers[i].ID == brokerID {
			return &p.Brokers[i], nil
		}
	}
	return nil, fmt.Errorf("broker %q not found in profile %q", brokerID, profileID)
}
