import type { KafkaMessage } from '@entities/message'

export interface FilterState {
  key: string
  value: string
}

/** Returns a filtered subset. Invalid regex falls back to substring match. */
export function applyFilter(messages: KafkaMessage[], filter: FilterState): KafkaMessage[] {
  const { key, value } = filter
  if (!key && !value) return messages

  const keyRe = tryRegex(key)
  const valRe = tryRegex(value)

  return messages.filter((msg) => {
    if (key) {
      const match = keyRe ? keyRe.test(msg.key) : msg.key.includes(key)
      if (!match) return false
    }
    if (value) {
      const match = valRe ? valRe.test(msg.value) : msg.value.includes(value)
      if (!match) return false
    }
    return true
  })
}

function tryRegex(pattern: string): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}
