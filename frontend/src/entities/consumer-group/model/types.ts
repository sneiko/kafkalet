// ConsumerGroup represents a Kafka consumer group.
// Lag data (per-partition) is populated in Phase 5 via ListConsumerGroups.
export interface ConsumerGroup {
  groupId: string
  topic: string
  state?: string // e.g. "Stable", "Empty"
}

export interface PartitionLag {
  partition: number
  currentOffset: number
  logEndOffset: number
  lag: number
}

// GroupSummary is a compact view of a consumer group for list displays.
export interface GroupSummary {
  groupId: string
  state: string
  totalLag: number
}

// GroupDetail contains per-topic/per-partition lag for a single group.
export interface GroupDetail {
  groupId: string
  state: string
  topics: GroupLagEntry[]
}

export interface GroupLagEntry {
  groupId: string
  topic: string
  totalLag: number
  partitions: GroupPartitionLag[]
}

export interface GroupPartitionLag {
  partition: number
  commitOffset: number
  logEndOffset: number
  lag: number
}

// TopicRate is the approximate message throughput for a single topic (from rate events).
export interface TopicRate {
  topic: string
  messagesPerSec: number
  totalMessages: number
}

// RateSnapshot is emitted by the "rate:<brokerId>" Wails event.
export interface RateSnapshot {
  topics: TopicRate[]
}
