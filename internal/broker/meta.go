package broker

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/kmsg"
	"kafkalet/internal/profile"
)

// PartitionMetadata describes a single partition's replication state.
type PartitionMetadata struct {
	Partition int32   `json:"partition"`
	Leader    int32   `json:"leader"`
	Replicas  []int32 `json:"replicas"`
	ISR       []int32 `json:"isr"`
}

// TopicMetadata is the full partition layout for a topic.
type TopicMetadata struct {
	Name       string              `json:"name"`
	Partitions []PartitionMetadata `json:"partitions"`
}

// PartitionLag is the lag for one partition in a consumer group.
type PartitionLag struct {
	Partition    int32 `json:"partition"`
	CommitOffset int64 `json:"commitOffset"`
	LogEndOffset int64 `json:"logEndOffset"`
	Lag          int64 `json:"lag"`
}

// GroupLag aggregates lag for a consumer group on a topic.
type GroupLag struct {
	GroupID    string         `json:"groupId"`
	Topic      string         `json:"topic"`
	TotalLag   int64          `json:"totalLag"`
	Partitions []PartitionLag `json:"partitions"`
}

// Topic is a Kafka topic with basic metadata returned to the frontend.
type Topic struct {
	Name       string `json:"name"`
	Partitions int    `json:"partitions"`
}

// TestConnection verifies broker reachability via an ApiVersions request.
// Uses its own short-lived client with a dedicated timeout.
func TestConnection(ctx context.Context, b profile.Broker, password string) error {
	ctx, cancel := context.WithTimeout(ctx, TimeoutConnection)
	defer cancel()

	client, err := NewClient(b, password)
	if err != nil {
		return fmt.Errorf("create client: %w", err)
	}
	defer client.Close()

	adm := kadm.NewClient(client)
	_, err = adm.ApiVersions(ctx)
	if err != nil {
		return fmt.Errorf("broker unreachable: %w", err)
	}
	return nil
}

// ListTopics fetches all topics with their partition counts.
func ListTopics(ctx context.Context, client *kgo.Client) ([]Topic, error) {
	adm := kadm.NewClient(client)
	details, err := adm.ListTopics(ctx)
	if err != nil {
		return nil, fmt.Errorf("list topics: %w", err)
	}

	topics := make([]Topic, 0, len(details))
	for _, td := range details {
		if td.Err != nil {
			continue
		}
		topics = append(topics, Topic{
			Name:       td.Topic,
			Partitions: len(td.Partitions),
		})
	}

	sort.Slice(topics, func(i, j int) bool {
		return topics[i].Name < topics[j].Name
	})
	return topics, nil
}

// GetTopicMetadata returns partition details (leader, replicas, ISR) for a topic.
func GetTopicMetadata(ctx context.Context, client *kgo.Client, topic string) (TopicMetadata, error) {
	adm := kadm.NewClient(client)
	details, err := adm.ListTopics(ctx, topic)
	if err != nil {
		return TopicMetadata{}, fmt.Errorf("list topics: %w", err)
	}

	td, ok := details[topic]
	if !ok {
		return TopicMetadata{}, fmt.Errorf("topic %q not found", topic)
	}
	if td.Err != nil {
		return TopicMetadata{}, fmt.Errorf("topic %q: %w", topic, td.Err)
	}

	meta := TopicMetadata{Name: topic, Partitions: make([]PartitionMetadata, 0, len(td.Partitions))}
	for _, p := range td.Partitions {
		if p.Err != nil {
			continue
		}
		meta.Partitions = append(meta.Partitions, PartitionMetadata{
			Partition: p.Partition,
			Leader:    p.Leader,
			Replicas:  p.Replicas,
			ISR:       p.ISR,
		})
	}
	sort.Slice(meta.Partitions, func(i, j int) bool {
		return meta.Partitions[i].Partition < meta.Partitions[j].Partition
	})
	return meta, nil
}

// ListConsumerGroupsForTopic returns lag metrics for all groups that have
// committed offsets for the given topic.
func ListConsumerGroupsForTopic(ctx context.Context, client *kgo.Client, topic string) ([]GroupLag, error) {
	adm := kadm.NewClient(client)

	listedGroups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}

	endOffsets, err := adm.ListEndOffsets(ctx, topic)
	if err != nil {
		return nil, fmt.Errorf("list end offsets: %w", err)
	}

	var result []GroupLag
	for _, g := range listedGroups {
		committed, fetchErr := adm.FetchOffsets(ctx, g.Group)
		if fetchErr != nil {
			continue
		}
		topicOffsets := committed[topic]
		if len(topicOffsets) == 0 {
			continue
		}

		gl := GroupLag{GroupID: g.Group, Topic: topic}
		for partition, offResp := range topicOffsets {
			if offResp.Err != nil {
				continue
			}
			endOff, _ := endOffsets.Lookup(topic, partition)
			commitAt := offResp.At
			lag := endOff.Offset - commitAt
			if lag < 0 {
				lag = 0
			}
			gl.Partitions = append(gl.Partitions, PartitionLag{
				Partition:    partition,
				CommitOffset: commitAt,
				LogEndOffset: endOff.Offset,
				Lag:          lag,
			})
			gl.TotalLag += lag
		}
		if len(gl.Partitions) > 0 {
			sort.Slice(gl.Partitions, func(i, j int) bool {
				return gl.Partitions[i].Partition < gl.Partitions[j].Partition
			})
			result = append(result, gl)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].GroupID < result[j].GroupID
	})
	return result, nil
}

// ResetConsumerGroup commits new offsets for a consumer group on a topic,
// effectively resetting where the group will read from.
//
// offset values:
//   - "earliest" — reset to the oldest available offset (log start)
//   - "latest"   — reset to the newest offset (log end, consume only future messages)
//   - numeric string (milliseconds since epoch) — seek to first offset at or after that time
func ResetConsumerGroup(ctx context.Context, client *kgo.Client, topic, groupID, offset string) error {
	adm := kadm.NewClient(client)

	var (
		listed kadm.ListedOffsets
		err    error
	)
	switch offset {
	case "earliest":
		listed, err = adm.ListStartOffsets(ctx, topic)
	case "latest":
		listed, err = adm.ListEndOffsets(ctx, topic)
	default:
		ms, parseErr := strconv.ParseInt(offset, 10, 64)
		if parseErr != nil {
			return fmt.Errorf("invalid offset %q: expected earliest, latest, or unix milliseconds", offset)
		}
		listed, err = adm.ListOffsetsAfterMilli(ctx, ms, topic)
	}
	if err != nil {
		return fmt.Errorf("list offsets: %w", err)
	}

	offsets := make(kadm.Offsets)
	listed.Each(func(l kadm.ListedOffset) {
		if l.Err != nil || l.Topic != topic {
			return
		}
		offsets.AddOffset(l.Topic, l.Partition, l.Offset, -1)
	})

	if len(offsets) == 0 {
		return fmt.Errorf("no partitions found for topic %q", topic)
	}

	resp, err := adm.CommitOffsets(ctx, groupID, offsets)
	if err != nil {
		return fmt.Errorf("commit offsets: %w", err)
	}
	return resp.Error()
}

// BrokerInfo summarises a single Kafka broker node.
type BrokerInfo struct {
	NodeID       int32  `json:"nodeId"`
	Host         string `json:"host"`
	Port         int32  `json:"port"`
	IsController bool   `json:"isController"`
}

// ClusterInfo is the high-level view of a Kafka cluster.
type ClusterInfo struct {
	ClusterID    string       `json:"clusterId"`
	ControllerID int32        `json:"controllerId"`
	Brokers      []BrokerInfo `json:"brokers"`
}

// GetClusterInfo fetches the cluster ID, controller, and broker list.
func GetClusterInfo(ctx context.Context, client *kgo.Client) (ClusterInfo, error) {
	adm := kadm.NewClient(client)
	meta, err := adm.BrokerMetadata(ctx)
	if err != nil {
		return ClusterInfo{}, fmt.Errorf("broker metadata: %w", err)
	}

	info := ClusterInfo{
		ClusterID:    meta.Cluster,
		ControllerID: meta.Controller,
		Brokers:      make([]BrokerInfo, 0, len(meta.Brokers)),
	}
	for _, br := range meta.Brokers {
		info.Brokers = append(info.Brokers, BrokerInfo{
			NodeID:       br.NodeID,
			Host:         br.Host,
			Port:         br.Port,
			IsController: br.NodeID == meta.Controller,
		})
	}
	sort.Slice(info.Brokers, func(i, j int) bool {
		return info.Brokers[i].NodeID < info.Brokers[j].NodeID
	})
	return info, nil
}

// ClusterStats holds aggregate health metrics for a Kafka cluster.
type ClusterStats struct {
	BrokerCount               int `json:"brokerCount"`
	TopicCount                int `json:"topicCount"`
	TotalPartitions           int `json:"totalPartitions"`
	UnderReplicatedPartitions int `json:"underReplicatedPartitions"`
	OfflinePartitions         int `json:"offlinePartitions"`
}

// GetClusterStats returns broker/topic/partition counts plus URP and offline partition counts.
func GetClusterStats(ctx context.Context, client *kgo.Client) (ClusterStats, error) {
	adm := kadm.NewClient(client)

	meta, err := adm.BrokerMetadata(ctx)
	if err != nil {
		return ClusterStats{}, fmt.Errorf("broker metadata: %w", err)
	}

	details, err := adm.ListTopics(ctx)
	if err != nil {
		return ClusterStats{}, fmt.Errorf("list topics: %w", err)
	}

	var stats ClusterStats
	stats.BrokerCount = len(meta.Brokers)
	for _, td := range details {
		if td.Err != nil {
			continue
		}
		stats.TopicCount++
		for _, p := range td.Partitions {
			if p.Err != nil {
				continue
			}
			stats.TotalPartitions++
			if p.Leader == -1 {
				stats.OfflinePartitions++
			} else if len(p.ISR) < len(p.Replicas) {
				stats.UnderReplicatedPartitions++
			}
		}
	}
	return stats, nil
}

// GroupSummary is a compact representation of a consumer group for list views.
type GroupSummary struct {
	GroupID  string `json:"groupId"`
	State    string `json:"state"`
	TotalLag int64  `json:"totalLag"`
}

// GroupDetail contains full lag breakdown for a consumer group across all topics.
type GroupDetail struct {
	GroupID string     `json:"groupId"`
	State   string     `json:"state"`
	Topics  []GroupLag `json:"topics"`
}

// ListAllConsumerGroups returns all consumer groups with their state and total lag.
func ListAllConsumerGroups(ctx context.Context, client *kgo.Client) ([]GroupSummary, error) {
	adm := kadm.NewClient(client)

	listedGroups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}

	groupIDs := make([]string, 0, len(listedGroups))
	for _, g := range listedGroups {
		groupIDs = append(groupIDs, g.Group)
	}

	described, err := adm.DescribeGroups(ctx, groupIDs...)
	if err != nil {
		return nil, fmt.Errorf("describe groups: %w", err)
	}

	stateMap := make(map[string]string, len(described))
	for _, dg := range described {
		stateMap[dg.Group] = dg.State
	}

	endOffsets, err := adm.ListEndOffsets(ctx)
	if err != nil {
		return nil, fmt.Errorf("list end offsets: %w", err)
	}

	result := make([]GroupSummary, 0, len(listedGroups))
	for _, g := range listedGroups {
		committed, fetchErr := adm.FetchOffsets(ctx, g.Group)
		var totalLag int64
		if fetchErr == nil {
			committed.Each(func(o kadm.OffsetResponse) {
				if o.Err != nil {
					return
				}
				endOff, _ := endOffsets.Lookup(o.Topic, o.Partition)
				lag := endOff.Offset - o.At
				if lag > 0 {
					totalLag += lag
				}
			})
		}
		result = append(result, GroupSummary{
			GroupID:  g.Group,
			State:    stateMap[g.Group],
			TotalLag: totalLag,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].GroupID < result[j].GroupID
	})
	return result, nil
}

// GetConsumerGroupDetail returns per-topic/per-partition lag for a single consumer group.
func GetConsumerGroupDetail(ctx context.Context, client *kgo.Client, groupID string) (GroupDetail, error) {
	adm := kadm.NewClient(client)

	described, err := adm.DescribeGroups(ctx, groupID)
	if err != nil {
		return GroupDetail{}, fmt.Errorf("describe group: %w", err)
	}
	dg, ok := described[groupID]
	if !ok {
		return GroupDetail{}, fmt.Errorf("group %q not found", groupID)
	}

	committed, err := adm.FetchOffsets(ctx, groupID)
	if err != nil {
		return GroupDetail{}, fmt.Errorf("fetch offsets: %w", err)
	}

	// collect topics from committed offsets
	topicSet := make(map[string]bool)
	committed.Each(func(o kadm.OffsetResponse) {
		topicSet[o.Topic] = true
	})
	topics := make([]string, 0, len(topicSet))
	for t := range topicSet {
		topics = append(topics, t)
	}

	endOffsets, err := adm.ListEndOffsets(ctx, topics...)
	if err != nil {
		return GroupDetail{}, fmt.Errorf("list end offsets: %w", err)
	}

	topicLags := make(map[string]*GroupLag)
	committed.Each(func(o kadm.OffsetResponse) {
		if o.Err != nil {
			return
		}
		endOff, _ := endOffsets.Lookup(o.Topic, o.Partition)
		lag := max(endOff.Offset-o.At, 0)
		gl, exists := topicLags[o.Topic]
		if !exists {
			gl = &GroupLag{GroupID: groupID, Topic: o.Topic}
			topicLags[o.Topic] = gl
		}
		gl.Partitions = append(gl.Partitions, PartitionLag{
			Partition:    o.Partition,
			CommitOffset: o.At,
			LogEndOffset: endOff.Offset,
			Lag:          lag,
		})
		gl.TotalLag += lag
	})

	detail := GroupDetail{GroupID: groupID, State: dg.State, Topics: make([]GroupLag, 0, len(topicLags))}
	for _, gl := range topicLags {
		sort.Slice(gl.Partitions, func(i, j int) bool {
			return gl.Partitions[i].Partition < gl.Partitions[j].Partition
		})
		detail.Topics = append(detail.Topics, *gl)
	}
	sort.Slice(detail.Topics, func(i, j int) bool {
		return detail.Topics[i].Topic < detail.Topics[j].Topic
	})
	return detail, nil
}

// CreateTopicRequest holds parameters for creating a new Kafka topic.
type CreateTopicRequest struct {
	Name              string `json:"name"`
	Partitions        int32  `json:"partitions"`
	ReplicationFactor int16  `json:"replicationFactor"`
}

// CreateTopic creates a new Kafka topic.
func CreateTopic(ctx context.Context, client *kgo.Client, req CreateTopicRequest) error {
	adm := kadm.NewClient(client)
	resp, err := adm.CreateTopics(ctx, req.Partitions, req.ReplicationFactor, nil, req.Name)
	if err != nil {
		return fmt.Errorf("create topic: %w", err)
	}
	return resp.Error()
}

// DeleteTopic deletes a Kafka topic by name.
func DeleteTopic(ctx context.Context, client *kgo.Client, name string) error {
	adm := kadm.NewClient(client)
	resp, err := adm.DeleteTopics(ctx, name)
	if err != nil {
		return fmt.Errorf("delete topic: %w", err)
	}
	return resp.Error()
}

// TopicConfigEntry represents a single topic configuration entry.
type TopicConfigEntry struct {
	Name      string `json:"name"`
	Value     string `json:"value"`
	IsDefault bool   `json:"isDefault"`
	ReadOnly  bool   `json:"readOnly"`
}

// GetTopicConfig returns the configuration entries for a topic.
func GetTopicConfig(ctx context.Context, client *kgo.Client, topic string) ([]TopicConfigEntry, error) {
	adm := kadm.NewClient(client)
	resp, err := adm.DescribeTopicConfigs(ctx, topic)
	if err != nil {
		return nil, fmt.Errorf("describe topic configs: %w", err)
	}

	var entries []TopicConfigEntry
	for _, rc := range resp {
		if rc.Err != nil {
			return nil, fmt.Errorf("topic %q config: %w", topic, rc.Err)
		}
		for _, cfg := range rc.Configs {
			val := ""
			if cfg.Value != nil {
				val = *cfg.Value
			}
			isDefault := cfg.Source == kmsg.ConfigSourceDefaultConfig
			entries = append(entries, TopicConfigEntry{
				Name:      cfg.Key,
				Value:     val,
				IsDefault: isDefault,
				ReadOnly:  false, // kadm.Config does not expose ReadOnly; treat all as editable
			})
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name < entries[j].Name
	})
	return entries, nil
}

// AlterTopicConfig updates a single configuration key for a topic.
func AlterTopicConfig(ctx context.Context, client *kgo.Client, topic, key, value string) error {
	adm := kadm.NewClient(client)
	resp, err := adm.AlterTopicConfigs(ctx, []kadm.AlterConfig{{Name: key, Value: &value}}, topic)
	if err != nil {
		return fmt.Errorf("alter topic config: %w", err)
	}
	_, alterErr := resp.On(topic, nil)
	return alterErr
}

// GetOffsetsAtTimestamp resolves, for each partition of a topic, the first
// offset whose timestamp is at or after the given Unix millisecond value.
func GetOffsetsAtTimestamp(ctx context.Context, client *kgo.Client, topic string, timestampMs int64) (map[int32]int64, error) {
	adm := kadm.NewClient(client)
	listed, err := adm.ListOffsetsAfterMilli(ctx, timestampMs, topic)
	if err != nil {
		return nil, fmt.Errorf("list offsets after milli: %w", err)
	}

	result := make(map[int32]int64)
	listed.Each(func(l kadm.ListedOffset) {
		if l.Err != nil || l.Topic != topic || l.Offset < 0 {
			return
		}
		result[l.Partition] = l.Offset
	})
	if len(result) == 0 {
		return nil, fmt.Errorf("no offsets found for topic %q at timestamp %d ms", topic, timestampMs)
	}
	return result, nil
}
