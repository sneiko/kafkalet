package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"kafkalet/internal/apperr"
	"kafkalet/internal/broker"
	"kafkalet/internal/plugin"
	"kafkalet/internal/profile"
	"kafkalet/internal/schema"
	"kafkalet/internal/search"
	"kafkalet/internal/stream"
	"kafkalet/internal/updater"
)

// App is the Wails-bound struct. All public methods become frontend RPCs.
// Keep methods thin — delegate to internal/ packages.
type App struct {
	ctx          context.Context
	version      string
	profileStore *profile.Store
	pluginStore  *plugin.Store
	streamMgr    *stream.Manager
	searchMgr    *search.Manager
	pool         *broker.Pool
	metaCache    *broker.MetaCache

	registries   map[string]*schema.Registry
	registriesMu sync.Mutex

	rateWatchers   map[string]context.CancelFunc // brokerID → cancel
	rateWatchersMu sync.Mutex
}

func NewApp(version string) *App {
	return &App{version: version}
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

	emit := func(name string, data any) {
		runtime.EventsEmit(ctx, name, data)
	}
	a.streamMgr = stream.NewManager(ctx, emit)
	a.searchMgr = search.NewManager(ctx, emit)

	a.pool = broker.NewPool(broker.PoolTTL, func(b profile.Broker, pw string) (*kgo.Client, error) {
		return broker.NewClient(b, pw)
	})

	a.metaCache = broker.NewMetaCache()
	a.registries = make(map[string]*schema.Registry)
	a.rateWatchers = make(map[string]context.CancelFunc)

	a.migrateCredentials()

	go func() {
		time.Sleep(3 * time.Second)
		rel, err := updater.CheckLatest(a.version)
		if err != nil {
			slog.Warn("update check failed", "err", err)
			return
		}
		if rel != nil {
			runtime.EventsEmit(ctx, "app:update-available", rel)
		}
	}()
}

func (a *App) shutdown(_ context.Context) {
	a.searchMgr.StopAll()
	a.stopAllRateWatchers()
	a.pool.Close()
}

// ── App info & updates ────────────────────────────────────────────────────────

// GetAppVersion returns the current application version.
func (a *App) GetAppVersion() string {
	return a.version
}

// CheckForUpdates checks GitHub for a newer release.
// Returns the release info if an update is available, nil otherwise.
func (a *App) CheckForUpdates() (*updater.Release, error) {
	return updater.CheckLatest(a.version)
}

// OpenURL opens the given URL in the user's default browser.
func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// pooledClient resolves auth, gets or creates a pooled client, and returns a
// context with TimeoutMetadata. Caller must defer cancel().
func (a *App) pooledClient(profileID, brokerID string) (context.Context, context.CancelFunc, *kgo.Client, error) {
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return nil, nil, nil, err
	}
	client, err := a.pool.Get(b, b.ActiveCredentialID, password)
	if err != nil {
		return nil, nil, nil, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, broker.TimeoutMetadata)
	return ctx, cancel, client, nil
}

// migrateCredentials converts legacy broker-level SASL to a named credential.
// For each broker that has SASL.Mechanism set but no credentials, it creates
// a "Default" credential and moves the SASL config + password there.
func (a *App) migrateCredentials() {
	profiles := a.profileStore.List()
	for _, p := range profiles {
		changed := false
		for i := range p.Brokers {
			b := &p.Brokers[i]
			if b.SASL.Mechanism != "" && len(b.Credentials) == 0 {
				credID := uuid.NewString()
				b.Credentials = []profile.NamedCredential{{
					ID:   credID,
					Name: "Default",
					SASL: b.SASL,
				}}
				// Move password from legacy keychain to credential keychain
				if pw, err := profile.GetPassword(p.ID, b.ID); err == nil && pw != "" {
					_ = profile.SaveNamedCredentialPassword(p.ID, b.ID, credID, pw)
					_ = profile.DeletePassword(p.ID, b.ID)
				}
				b.ActiveCredentialID = credID
				b.SASL = profile.SASLConfig{}
				changed = true
			}
		}
		if changed {
			if err := a.profileStore.Update(p); err != nil {
				slog.Warn("migrate credentials failed", "profile", p.ID, "err", err)
			}
		}
	}
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
	if strings.TrimSpace(name) == "" {
		return profile.Profile{}, apperr.Required("name")
	}
	return a.profileStore.Create(profile.Profile{Name: strings.TrimSpace(name)})
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
	TopicGroups            []profile.TopicGroup         `json:"topicGroups,omitempty"`
	PinnedTopics           []string                     `json:"pinnedTopics,omitempty"`
}

type exportCredential struct {
	ID       string             `json:"id"`
	Name     string             `json:"name"`
	SASL     profile.SASLConfig `json:"sasl"`
	Password string             `json:"password,omitempty"`
}

// ExportSettings saves all profiles to a user-chosen JSON file.
// When includeSecrets is false, passwords are omitted from the export.
func (a *App) ExportSettings(includeSecrets bool) error {
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
				TopicGroups:        b.TopicGroups,
				PinnedTopics:       b.PinnedTopics,
			}
			if includeSecrets {
				eb.SASLPassword, _ = profile.GetPassword(p.ID, b.ID)
				eb.SchemaRegistryPassword, _ = profile.GetSchemaRegistryPassword(p.ID, b.ID)
			}
			for _, cred := range b.Credentials {
				ec := exportCredential{ID: cred.ID, Name: cred.Name, SASL: cred.SASL}
				if includeSecrets {
					ec.Password, _ = profile.GetNamedCredentialPassword(p.ID, b.ID, cred.ID)
				}
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
		migratedCreds := map[string]string{} // brokerID → credID for migrated legacy SASL
		for _, eb := range ep.Brokers {
			b := profile.Broker{
				ID:                 eb.ID,
				Name:               eb.Name,
				Addresses:          eb.Addresses,
				SASL:               eb.SASL,
				TLS:                eb.TLS,
				SchemaRegistry:     eb.SchemaRegistry,
				ActiveCredentialID: eb.ActiveCredentialID,
				TopicGroups:        eb.TopicGroups,
				PinnedTopics:       eb.PinnedTopics,
			}
			for _, ec := range eb.Credentials {
				b.Credentials = append(b.Credentials, profile.NamedCredential{
					ID: ec.ID, Name: ec.Name, SASL: ec.SASL,
				})
			}
			// Migrate legacy SASL to credential
			if b.SASL.Mechanism != "" && len(b.Credentials) == 0 {
				credID := uuid.NewString()
				b.Credentials = []profile.NamedCredential{{
					ID:   credID,
					Name: "Default",
					SASL: b.SASL,
				}}
				b.ActiveCredentialID = credID
				b.SASL = profile.SASLConfig{}
				migratedCreds[b.ID] = credID
			}
			newProfile.Brokers = append(newProfile.Brokers, b)
		}
		if _, err := a.profileStore.Create(newProfile); err != nil {
			slog.Warn("import profile failed", "id", ep.ID, "err", err)
			continue
		}
		// Restore passwords to keychain
		for _, eb := range ep.Brokers {
			if eb.SchemaRegistryPassword != "" {
				_ = profile.SaveSchemaRegistryPassword(ep.ID, eb.ID, eb.SchemaRegistryPassword)
			}
			for _, ec := range eb.Credentials {
				if ec.Password != "" {
					_ = profile.SaveNamedCredentialPassword(ep.ID, eb.ID, ec.ID, ec.Password)
				}
			}
			if credID, ok := migratedCreds[eb.ID]; ok && eb.SASLPassword != "" {
				_ = profile.SaveNamedCredentialPassword(ep.ID, eb.ID, credID, eb.SASLPassword)
			} else if eb.SASLPassword != "" {
				_ = profile.SavePassword(ep.ID, eb.ID, eb.SASLPassword)
			}
		}
	}
	runtime.EventsEmit(a.ctx, "profiles:imported", nil)
	return nil
}

// RenameProfile updates only the name of a profile.
func (a *App) RenameProfile(id, name string) error {
	if strings.TrimSpace(name) == "" {
		return apperr.Required("name")
	}
	p, err := a.profileStore.Get(id)
	if err != nil {
		return err
	}
	p.Name = strings.TrimSpace(name)
	return a.profileStore.Update(*p)
}

// SwitchProfile stops all active stream sessions, clears the connection pool,
// caches, shared registries, and rate watchers, then switches the active profile.
func (a *App) SwitchProfile(id string) error {
	a.streamMgr.StopAll()
	a.searchMgr.StopAll()
	a.pool.CloseAll()
	a.metaCache.InvalidateAll()
	a.stopAllRateWatchers()

	a.registriesMu.Lock()
	a.registries = make(map[string]*schema.Registry)
	a.registriesMu.Unlock()

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

// SwitchBrokerCredential stops all sessions for a broker, evicts pooled clients,
// clears caches/registry/rate watcher, sets the active credential, and emits an event.
func (a *App) SwitchBrokerCredential(profileID, brokerID, credentialID string) error {
	a.streamMgr.StopBroker(brokerID)
	a.searchMgr.StopBroker(brokerID)
	a.pool.EvictBroker(brokerID)
	a.metaCache.InvalidateBroker(brokerID)
	a.stopRateWatcher(brokerID)
	a.evictRegistry(brokerID)
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

// ClearActiveBrokerCredential resets the broker to use its default SASL credentials.
func (a *App) ClearActiveBrokerCredential(profileID, brokerID string) error {
	a.streamMgr.StopBroker(brokerID)
	a.pool.EvictBroker(brokerID)
	a.metaCache.InvalidateBroker(brokerID)
	a.stopRateWatcher(brokerID)
	a.evictRegistry(brokerID)
	return a.profileStore.ClearActiveBrokerCredential(profileID, brokerID)
}

// TestConnectionDirect tests a broker connection using inline parameters,
// without requiring a saved broker. Useful for testing credentials before saving.
func (a *App) TestConnectionDirect(
	addresses []string,
	tls profile.TLSConfig,
	sasl profile.SASLConfig,
	password string,
) error {
	b := profile.Broker{
		Addresses: addresses,
		SASL:      sasl,
		TLS:       tls,
	}
	return broker.TestConnection(a.ctx, b, password)
}

// TestBrokerConnection fetches the password from the keychain and sends an
// ApiVersions request to verify the broker is reachable.
func (a *App) TestBrokerConnection(profileID, brokerID string) error {
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return err
	}
	return broker.TestConnection(a.ctx, b, password)
}

// ── Pinned topics ─────────────────────────────────────────────────────────────

// PinTopic adds a topic to the broker's pinned list.
func (a *App) PinTopic(profileID, brokerID, topic string) error {
	return a.profileStore.PinTopic(profileID, brokerID, topic)
}

// UnpinTopic removes a topic from the broker's pinned list.
func (a *App) UnpinTopic(profileID, brokerID, topic string) error {
	return a.profileStore.UnpinTopic(profileID, brokerID, topic)
}

// ── Topic groups ──────────────────────────────────────────────────────────────

// SaveTopicGroup creates or updates a topic group for a broker.
func (a *App) SaveTopicGroup(profileID, brokerID string, g profile.TopicGroup) error {
	return a.profileStore.SaveTopicGroup(profileID, brokerID, g)
}

// DeleteTopicGroup removes a topic group from a broker.
func (a *App) DeleteTopicGroup(profileID, brokerID, groupID string) error {
	return a.profileStore.DeleteTopicGroup(profileID, brokerID, groupID)
}

// ── Broker metadata ───────────────────────────────────────────────────────────

// ListTopics fetches all topics with partition counts from the given broker.
// Results are cached with a 30s TTL.
func (a *App) ListTopics(profileID, brokerID string) ([]broker.Topic, error) {
	if cached, ok := a.metaCache.GetTopics(brokerID); ok {
		return cached, nil
	}
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	defer cancel()
	topics, err := broker.ListTopics(ctx, client)
	if err != nil {
		return nil, err
	}
	a.metaCache.SetTopics(brokerID, topics)
	return topics, nil
}

// InvalidateTopicsCache clears the topics cache for a broker.
// Call before ListTopics to force a fresh fetch (e.g. on Refresh button).
func (a *App) InvalidateTopicsCache(brokerID string) {
	a.metaCache.InvalidateTopics(brokerID)
}

// ── Producer ──────────────────────────────────────────────────────────────────

// ProduceMessage produces a single message to a Kafka topic synchronously.
func (a *App) ProduceMessage(profileID, brokerID string, req broker.ProduceRequest) error {
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return err
	}
	return broker.ProduceMessage(a.ctx, b, password, req)
}

// GetTopicMetadata returns partition details (leader, replicas, ISR) for a topic.
func (a *App) GetTopicMetadata(profileID, brokerID, topic string) (broker.TopicMetadata, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return broker.TopicMetadata{}, err
	}
	defer cancel()
	return broker.GetTopicMetadata(ctx, client, topic)
}

// ResetConsumerGroup commits new offsets for a consumer group on a topic.
// offset: "earliest" | "latest" | unix milliseconds as string.
func (a *App) ResetConsumerGroup(profileID, brokerID, topic, groupID, offset string) error {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return err
	}
	defer cancel()
	return broker.ResetConsumerGroup(ctx, client, topic, groupID, offset)
}

// ListConsumerGroups returns lag metrics for all consumer groups on a topic.
func (a *App) ListConsumerGroups(profileID, brokerID, topic string) ([]broker.GroupLag, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	defer cancel()
	return broker.ListConsumerGroupsForTopic(ctx, client, topic)
}

// GetClusterInfo returns the cluster ID, controller node ID, and broker list.
// Results are cached with a 60s TTL.
func (a *App) GetClusterInfo(profileID, brokerID string) (broker.ClusterInfo, error) {
	if cached, ok := a.metaCache.GetClusterInfo(brokerID); ok {
		return cached, nil
	}
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return broker.ClusterInfo{}, err
	}
	defer cancel()
	info, err := broker.GetClusterInfo(ctx, client)
	if err != nil {
		return broker.ClusterInfo{}, err
	}
	a.metaCache.SetClusterInfo(brokerID, info)
	return info, nil
}

// StartObserverAtTimestamp resolves partition offsets at the given Unix
// millisecond timestamp and starts an observer session from those offsets.
func (a *App) StartObserverAtTimestamp(profileID, brokerID, topic string, timestampMs int64) (string, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return "", err
	}
	partitionOffsets, err := broker.GetOffsetsAtTimestamp(ctx, client, topic, timestampMs)
	cancel()
	if err != nil {
		return "", fmt.Errorf("resolve timestamp offsets: %w", err)
	}

	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return "", err
	}
	return a.streamMgr.StartObserver(b, password, topic, stream.ObserverOpts{
		PartitionOffsets: partitionOffsets,
		Registry:         a.getOrCreateRegistry(profileID, b),
	})
}

// ── Topic management ──────────────────────────────────────────────────────────

// CreateTopic creates a new topic on the given broker.
func (a *App) CreateTopic(profileID, brokerID string, req broker.CreateTopicRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return apperr.Required("topic name")
	}
	if req.Partitions <= 0 {
		return apperr.Positive("partitions")
	}
	if req.ReplicationFactor <= 0 {
		return apperr.Positive("replication factor")
	}
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return err
	}
	defer cancel()
	if err := broker.CreateTopic(ctx, client, req); err != nil {
		return err
	}
	a.metaCache.InvalidateTopics(brokerID)
	return nil
}

// DeleteTopic deletes a topic from the given broker.
func (a *App) DeleteTopic(profileID, brokerID, topicName string) error {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return err
	}
	defer cancel()
	if err := broker.DeleteTopic(ctx, client, topicName); err != nil {
		return err
	}
	a.metaCache.InvalidateTopics(brokerID)
	return nil
}

// GetTopicConfig returns the configuration for a topic.
func (a *App) GetTopicConfig(profileID, brokerID, topicName string) ([]broker.TopicConfigEntry, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	defer cancel()
	return broker.GetTopicConfig(ctx, client, topicName)
}

// AlterTopicConfig updates a single configuration key for a topic.
func (a *App) AlterTopicConfig(profileID, brokerID, topicName, key, value string) error {
	if key == "" {
		return apperr.Required("config key")
	}
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return err
	}
	defer cancel()
	return broker.AlterTopicConfig(ctx, client, topicName, key, value)
}

// ── Stream sessions ───────────────────────────────────────────────────────────

// StartObserver starts reading a topic without joining a consumer group.
// startOffset: "latest" (default) | "earliest"
// Returns the session ID to subscribe to "stream:<sessionID>" events.
func (a *App) StartObserver(profileID, brokerID, topic, startOffset string) (string, error) {
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return "", err
	}
	return a.streamMgr.StartObserver(b, password, topic, stream.ObserverOpts{
		StartOffset: startOffset,
		Registry:    a.getOrCreateRegistry(profileID, b),
	})
}

// StartConsumer joins a consumer group and starts reading a topic.
// groupID is the Kafka consumer group name.
// startOffset: "latest" (default) | "earliest" — reset position for new groups.
// Returns the session ID to subscribe to "stream:<sessionID>" events.
func (a *App) StartConsumer(profileID, brokerID, topic, groupID, startOffset string) (string, error) {
	if strings.TrimSpace(groupID) == "" {
		return "", apperr.Required("group ID")
	}
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return "", err
	}
	return a.streamMgr.StartConsumer(b, password, topic, stream.ConsumerOpts{
		GroupID:     groupID,
		StartOffset: startOffset,
		Registry:    a.getOrCreateRegistry(profileID, b),
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

// ── Search sessions ───────────────────────────────────────────────────────────

// StartSearch starts a topic search session. Returns the session ID.
// Frontend subscribes to "search:match:<sessionID>" and "search:progress:<sessionID>".
func (a *App) StartSearch(profileID, brokerID string, req search.SearchRequest) (string, error) {
	if strings.TrimSpace(req.Topic) == "" {
		return "", apperr.Required("topic")
	}
	if strings.TrimSpace(req.KeyPattern) == "" && strings.TrimSpace(req.ValuePattern) == "" {
		return "", apperr.Validation("pattern", "at least one of key or value pattern is required")
	}
	if req.UseRegex {
		if req.KeyPattern != "" {
			if _, err := regexp.Compile(req.KeyPattern); err != nil {
				return "", apperr.Validation("keyPattern", "invalid regex: "+err.Error())
			}
		}
		if req.ValuePattern != "" {
			if _, err := regexp.Compile(req.ValuePattern); err != nil {
				return "", apperr.Validation("valuePattern", "invalid regex: "+err.Error())
			}
		}
	}
	if req.MaxResults <= 0 {
		req.MaxResults = 1000
	}
	if req.MaxScan <= 0 {
		req.MaxScan = 1_000_000
	}

	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return "", err
	}
	return a.searchMgr.StartSearch(b, password, req, a.getOrCreateRegistry(profileID, b))
}

// StopSearch stops an active search session.
func (a *App) StopSearch(sessionID string) error {
	a.searchMgr.Stop(sessionID)
	return nil
}

// ── Cluster metrics ───────────────────────────────────────────────────────────

// GetClusterStats returns aggregate broker/topic/partition counts plus URP and offline partitions.
// Results are cached with a 15s TTL.
func (a *App) GetClusterStats(profileID, brokerID string) (broker.ClusterStats, error) {
	if cached, ok := a.metaCache.GetClusterStats(brokerID); ok {
		return cached, nil
	}
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return broker.ClusterStats{}, err
	}
	defer cancel()
	stats, err := broker.GetClusterStats(ctx, client)
	if err != nil {
		return broker.ClusterStats{}, err
	}
	a.metaCache.SetClusterStats(brokerID, stats)
	return stats, nil
}

// ListAllConsumerGroups returns all consumer groups with state and total lag.
func (a *App) ListAllConsumerGroups(profileID, brokerID string) ([]broker.GroupSummary, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	defer cancel()
	return broker.ListAllConsumerGroups(ctx, client)
}

// DescribeConsumerGroupMembers returns the members of a consumer group.
func (a *App) DescribeConsumerGroupMembers(profileID, brokerID, groupID string) ([]broker.GroupMemberInfo, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return nil, err
	}
	defer cancel()
	return broker.DescribeConsumerGroupMembers(ctx, client, groupID)
}

// DeleteConsumerGroup deletes a consumer group from the cluster.
func (a *App) DeleteConsumerGroup(profileID, brokerID, groupID string) error {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return err
	}
	defer cancel()
	return broker.DeleteConsumerGroup(ctx, client, groupID)
}

// GetConsumerGroupDetail returns per-topic/per-partition lag for a single group.
func (a *App) GetConsumerGroupDetail(profileID, brokerID, groupID string) (broker.GroupDetail, error) {
	ctx, cancel, client, err := a.pooledClient(profileID, brokerID)
	if err != nil {
		return broker.GroupDetail{}, err
	}
	defer cancel()
	return broker.GetConsumerGroupDetail(ctx, client, groupID)
}

// StartRateWatcher starts a goroutine that polls LEO for all topics every 30s
// and emits snapshots on the "rate:<brokerID>" event. Stops any previous watcher
// for the same broker.
func (a *App) StartRateWatcher(profileID, brokerID string) error {
	b, password, err := a.resolveBrokerAuth(profileID, brokerID)
	if err != nil {
		return err
	}

	a.rateWatchersMu.Lock()
	if cancel, ok := a.rateWatchers[brokerID]; ok {
		cancel()
		delete(a.rateWatchers, brokerID)
	}
	a.rateWatchersMu.Unlock()

	eventName := "rate:" + brokerID
	cancel, err := broker.StartRateWatcher(a.ctx, b, password, 30, func(snap broker.RateSnapshot) {
		runtime.EventsEmit(a.ctx, eventName, snap)
	})
	if err != nil {
		return err
	}

	a.rateWatchersMu.Lock()
	a.rateWatchers[brokerID] = cancel
	a.rateWatchersMu.Unlock()
	return nil
}

// StopRateWatcher stops the rate watcher for a specific broker.
func (a *App) StopRateWatcher(brokerID string) {
	a.stopRateWatcher(brokerID)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// resolveBrokerAuth returns a copy of the broker with SASL overridden by the
// active credential (if any) and the corresponding password.
// 1. ActiveCredentialID set → use that credential's SASL + password
// 2. No active credential but credentials exist → auto-select first
// 3. No credentials → empty SASL, empty password (no auth)
func (a *App) resolveBrokerAuth(profileID, brokerID string) (profile.Broker, string, error) {
	b, err := a.findBroker(profileID, brokerID)
	if err != nil {
		return profile.Broker{}, "", err
	}
	bc := *b // work on a copy

	if bc.ActiveCredentialID != "" {
		for _, c := range bc.Credentials {
			if c.ID == bc.ActiveCredentialID {
				bc.SASL = c.SASL
				pw, err := profile.GetNamedCredentialPassword(profileID, brokerID, c.ID)
				if err != nil {
					return profile.Broker{}, "", fmt.Errorf("credential password: %w", err)
				}
				return bc, pw, nil
			}
		}
	}

	if len(bc.Credentials) > 0 {
		c := bc.Credentials[0]
		bc.SASL = c.SASL
		pw, err := profile.GetNamedCredentialPassword(profileID, brokerID, c.ID)
		if err != nil {
			return profile.Broker{}, "", fmt.Errorf("credential password: %w", err)
		}
		return bc, pw, nil
	}

	// No credentials — no auth
	bc.SASL = profile.SASLConfig{}
	return bc, "", nil
}

// getOrCreateRegistry returns a shared schema.Registry for a broker,
// creating one on first use. Returns nil if Schema Registry is not configured.
func (a *App) getOrCreateRegistry(profileID string, b profile.Broker) *schema.Registry {
	if b.SchemaRegistry.URL == "" {
		return nil
	}
	a.registriesMu.Lock()
	defer a.registriesMu.Unlock()
	if reg, ok := a.registries[b.ID]; ok {
		return reg
	}
	password, _ := profile.GetSchemaRegistryPassword(profileID, b.ID)
	reg := schema.New(b.SchemaRegistry.URL, b.SchemaRegistry.Username, password)
	a.registries[b.ID] = reg
	return reg
}

// evictRegistry removes the shared schema registry for a broker.
func (a *App) evictRegistry(brokerID string) {
	a.registriesMu.Lock()
	defer a.registriesMu.Unlock()
	delete(a.registries, brokerID)
}

// stopRateWatcher stops the rate watcher for a specific broker (internal).
func (a *App) stopRateWatcher(brokerID string) {
	a.rateWatchersMu.Lock()
	defer a.rateWatchersMu.Unlock()
	if cancel, ok := a.rateWatchers[brokerID]; ok {
		cancel()
		delete(a.rateWatchers, brokerID)
	}
}

// stopAllRateWatchers stops all active rate watchers.
func (a *App) stopAllRateWatchers() {
	a.rateWatchersMu.Lock()
	defer a.rateWatchersMu.Unlock()
	for id, cancel := range a.rateWatchers {
		cancel()
		delete(a.rateWatchers, id)
	}
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
	return nil, apperr.NotFound("broker", brokerID)
}
