package broker

import "time"

const (
	TimeoutDial       = 10 * time.Second // TCP connect
	TimeoutMetadata   = 15 * time.Second // ListTopics, GetClusterInfo, etc.
	TimeoutConnection = 10 * time.Second // TestConnection
	TimeoutProduce    = 10 * time.Second // ProduceMessage
	PoolTTL           = 2 * time.Minute  // idle client eviction
)
