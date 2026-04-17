import type { KafkaMessage } from '../model/types'
import type { SortKey, SortState } from '../model/sort'

type Comparator = (a: KafkaMessage, b: KafkaMessage) => number

function comparePartitionOffset(a: KafkaMessage, b: KafkaMessage): number {
  if (a.partition !== b.partition) return a.partition - b.partition
  return a.offset - b.offset
}

function compareTimestamp(a: KafkaMessage, b: KafkaMessage): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp)
}

function compareKey(a: KafkaMessage, b: KafkaMessage): number {
  return a.key.localeCompare(b.key)
}

function compareValue(a: KafkaMessage, b: KafkaMessage): number {
  return a.value.localeCompare(b.value)
}

function baseFor(field: SortKey['field']): Comparator {
  switch (field) {
    case 'partition-offset':
      return comparePartitionOffset
    case 'timestamp':
      return compareTimestamp
    case 'key':
      return compareKey
    case 'value':
      return compareValue
  }
}

export function getComparator(sorts: SortState): Comparator {
  const chain: Comparator[] = sorts.map((s) => {
    const base = baseFor(s.field)
    return s.direction === 'asc' ? base : (a, b) => -base(a, b)
  })
  // Stable tiebreak so list positions stay predictable when sort keys tie.
  chain.push(comparePartitionOffset)

  return (a, b) => {
    for (const cmp of chain) {
      const result = cmp(a, b)
      if (result !== 0) return result
    }
    return 0
  }
}
