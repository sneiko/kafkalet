import type { KafkaMessage } from '../model/types'
import type { ColumnFilterState, OffsetFilter, TimestampFilter } from '../model/filter'

function tryRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

function parseIntOrNaN(value: string): number {
  const trimmed = value.trim()
  if (trimmed === '') return NaN
  const n = Number(trimmed)
  return Number.isInteger(n) ? n : NaN
}

function matchesOffset(msg: KafkaMessage, f: OffsetFilter): boolean {
  const partition = parseIntOrNaN(f.partition)
  if (!Number.isNaN(partition) && msg.partition !== partition) return false

  const min = parseIntOrNaN(f.offsetMin)
  if (!Number.isNaN(min) && msg.offset < min) return false

  const max = parseIntOrNaN(f.offsetMax)
  if (!Number.isNaN(max) && msg.offset > max) return false

  return true
}

function matchesTimestamp(msg: KafkaMessage, f: TimestampFilter): boolean {
  const msgTs = Date.parse(msg.timestamp)
  if (Number.isNaN(msgTs)) return true

  if (f.from.trim() !== '') {
    const from = Date.parse(f.from)
    if (!Number.isNaN(from) && msgTs < from) return false
  }
  if (f.to.trim() !== '') {
    const to = Date.parse(f.to)
    if (!Number.isNaN(to) && msgTs > to) return false
  }
  return true
}

function matchesText(field: string, pattern: string): boolean {
  if (pattern === '') return true
  const re = tryRegex(pattern)
  return re ? re.test(field) : field.toLowerCase().includes(pattern.toLowerCase())
}

export function applyColumnFilter(
  messages: KafkaMessage[],
  filter: ColumnFilterState,
): KafkaMessage[] {
  return messages.filter(
    (msg) =>
      matchesOffset(msg, filter.offset) &&
      matchesTimestamp(msg, filter.timestamp) &&
      matchesText(msg.key, filter.key) &&
      matchesText(msg.value, filter.value),
  )
}
