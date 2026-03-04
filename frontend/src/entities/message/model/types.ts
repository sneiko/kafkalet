export interface KafkaMessage {
  topic: string
  partition: number
  offset: number
  key: string
  value: string
  timestamp: string // ISO 8601
  headers: Array<{ key: string; value: string }>
}
