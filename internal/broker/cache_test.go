package broker

import (
	"testing"
	"time"
)

func TestSetGetTopics(t *testing.T) {
	c := NewMetaCache()
	topics := []Topic{
		{Name: "orders", Partitions: 3},
		{Name: "events", Partitions: 6},
	}

	c.SetTopics("broker-1", topics)

	got, ok := c.GetTopics("broker-1")
	if !ok {
		t.Fatal("GetTopics returned miss for broker-1 after Set")
	}
	if len(got) != len(topics) {
		t.Fatalf("GetTopics returned %d topics, want %d", len(got), len(topics))
	}
	for i, tp := range topics {
		if got[i].Name != tp.Name || got[i].Partitions != tp.Partitions {
			t.Errorf("topic[%d] = %+v, want %+v", i, got[i], tp)
		}
	}

	// Different brokerID should miss.
	_, ok = c.GetTopics("broker-2")
	if ok {
		t.Error("GetTopics returned hit for broker-2, expected miss")
	}
}

func TestTopicsTTLExpiry(t *testing.T) {
	c := NewMetaCache()
	c.TopicsTTL = time.Millisecond

	c.SetTopics("broker-1", []Topic{{Name: "t", Partitions: 1}})
	time.Sleep(5 * time.Millisecond)

	_, ok := c.GetTopics("broker-1")
	if ok {
		t.Error("GetTopics returned hit after TTL expiry, expected miss")
	}
}

func TestSetGetClusterInfo(t *testing.T) {
	c := NewMetaCache()
	info := ClusterInfo{
		ClusterID:    "cluster-abc",
		ControllerID: 1,
		Brokers: []BrokerInfo{
			{NodeID: 1, Host: "kafka-1", Port: 9092, IsController: true},
			{NodeID: 2, Host: "kafka-2", Port: 9092, IsController: false},
		},
	}

	c.SetClusterInfo("broker-1", info)

	got, ok := c.GetClusterInfo("broker-1")
	if !ok {
		t.Fatal("GetClusterInfo returned miss after Set")
	}
	if got.ClusterID != info.ClusterID {
		t.Errorf("ClusterID = %q, want %q", got.ClusterID, info.ClusterID)
	}
	if got.ControllerID != info.ControllerID {
		t.Errorf("ControllerID = %d, want %d", got.ControllerID, info.ControllerID)
	}
	if len(got.Brokers) != len(info.Brokers) {
		t.Fatalf("Brokers count = %d, want %d", len(got.Brokers), len(info.Brokers))
	}
}

func TestClusterInfoTTLExpiry(t *testing.T) {
	c := NewMetaCache()
	c.ClusterInfoTTL = time.Millisecond

	c.SetClusterInfo("broker-1", ClusterInfo{ClusterID: "c1"})
	time.Sleep(5 * time.Millisecond)

	_, ok := c.GetClusterInfo("broker-1")
	if ok {
		t.Error("GetClusterInfo returned hit after TTL expiry, expected miss")
	}
}

func TestSetGetClusterStats(t *testing.T) {
	c := NewMetaCache()
	stats := ClusterStats{
		BrokerCount:               3,
		TopicCount:                10,
		TotalPartitions:           30,
		UnderReplicatedPartitions: 0,
		OfflinePartitions:         0,
	}

	c.SetClusterStats("broker-1", stats)

	got, ok := c.GetClusterStats("broker-1")
	if !ok {
		t.Fatal("GetClusterStats returned miss after Set")
	}
	if got != stats {
		t.Errorf("GetClusterStats = %+v, want %+v", got, stats)
	}
}

func TestClusterStatsTTLExpiry(t *testing.T) {
	c := NewMetaCache()
	c.ClusterStatsTTL = time.Millisecond

	c.SetClusterStats("broker-1", ClusterStats{TopicCount: 5})
	time.Sleep(5 * time.Millisecond)

	_, ok := c.GetClusterStats("broker-1")
	if ok {
		t.Error("GetClusterStats returned hit after TTL expiry, expected miss")
	}
}

func TestInvalidateTopics(t *testing.T) {
	c := NewMetaCache()

	c.SetTopics("broker-1", []Topic{{Name: "t1", Partitions: 1}})
	c.SetClusterStats("broker-1", ClusterStats{TopicCount: 1})
	c.SetClusterInfo("broker-1", ClusterInfo{ClusterID: "c1"})

	c.InvalidateTopics("broker-1")

	// Topics should be cleared.
	if _, ok := c.GetTopics("broker-1"); ok {
		t.Error("GetTopics returned hit after InvalidateTopics")
	}
	// ClusterStats should be cleared (contains topic count).
	if _, ok := c.GetClusterStats("broker-1"); ok {
		t.Error("GetClusterStats returned hit after InvalidateTopics")
	}
	// ClusterInfo should NOT be cleared.
	if _, ok := c.GetClusterInfo("broker-1"); !ok {
		t.Error("GetClusterInfo returned miss after InvalidateTopics, should be preserved")
	}
}

func TestInvalidateBroker(t *testing.T) {
	c := NewMetaCache()

	c.SetTopics("broker-1", []Topic{{Name: "t1", Partitions: 1}})
	c.SetClusterInfo("broker-1", ClusterInfo{ClusterID: "c1"})
	c.SetClusterStats("broker-1", ClusterStats{TopicCount: 1})

	c.SetTopics("broker-2", []Topic{{Name: "t2", Partitions: 2}})

	c.InvalidateBroker("broker-1")

	// broker-1 should be fully cleared.
	if _, ok := c.GetTopics("broker-1"); ok {
		t.Error("GetTopics for broker-1 returned hit after InvalidateBroker")
	}
	if _, ok := c.GetClusterInfo("broker-1"); ok {
		t.Error("GetClusterInfo for broker-1 returned hit after InvalidateBroker")
	}
	if _, ok := c.GetClusterStats("broker-1"); ok {
		t.Error("GetClusterStats for broker-1 returned hit after InvalidateBroker")
	}

	// broker-2 should be intact.
	if _, ok := c.GetTopics("broker-2"); !ok {
		t.Error("GetTopics for broker-2 returned miss, should be unaffected")
	}
}

func TestInvalidateAll(t *testing.T) {
	c := NewMetaCache()

	c.SetTopics("broker-1", []Topic{{Name: "t1", Partitions: 1}})
	c.SetClusterInfo("broker-1", ClusterInfo{ClusterID: "c1"})
	c.SetTopics("broker-2", []Topic{{Name: "t2", Partitions: 2}})
	c.SetClusterInfo("broker-2", ClusterInfo{ClusterID: "c2"})

	c.InvalidateAll()

	if _, ok := c.GetTopics("broker-1"); ok {
		t.Error("GetTopics for broker-1 returned hit after InvalidateAll")
	}
	if _, ok := c.GetClusterInfo("broker-1"); ok {
		t.Error("GetClusterInfo for broker-1 returned hit after InvalidateAll")
	}
	if _, ok := c.GetTopics("broker-2"); ok {
		t.Error("GetTopics for broker-2 returned hit after InvalidateAll")
	}
	if _, ok := c.GetClusterInfo("broker-2"); ok {
		t.Error("GetClusterInfo for broker-2 returned hit after InvalidateAll")
	}
}

func TestGetMissingBroker(t *testing.T) {
	c := NewMetaCache()

	topics, ok := c.GetTopics("nonexistent")
	if ok {
		t.Error("GetTopics returned hit for nonexistent broker")
	}
	if topics != nil {
		t.Errorf("GetTopics returned %v, want nil", topics)
	}

	info, ok := c.GetClusterInfo("nonexistent")
	if ok {
		t.Error("GetClusterInfo returned hit for nonexistent broker")
	}
	if info.ClusterID != "" || info.ControllerID != 0 || info.Brokers != nil {
		t.Errorf("GetClusterInfo returned %+v, want zero value", info)
	}

	stats, ok := c.GetClusterStats("nonexistent")
	if ok {
		t.Error("GetClusterStats returned hit for nonexistent broker")
	}
	if stats != (ClusterStats{}) {
		t.Errorf("GetClusterStats returned %+v, want zero value", stats)
	}
}
