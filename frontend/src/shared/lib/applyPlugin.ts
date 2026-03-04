import type { Plugin } from '@entities/plugin'

export interface RawMessage {
  value: string
  key: string
  headers?: Array<{ key: string; value: string }>
}

/**
 * Find the first plugin whose topicPattern matches the topic and run its
 * decode script against the message value.
 *
 * The plugin script is a JS function body with parameters:
 *   value   – the raw message value string
 *   key     – the message key string
 *   headers – plain object { headerKey: headerValue, ... }
 * It must return a string (or a value that will be JSON-serialised).
 *
 * Returns null if no plugin matches.
 */
export function applyPlugin(
  msg: RawMessage,
  topic: string,
  plugins: Plugin[],
): string | null {
  const matching = plugins.find((p) => {
    if (!p.topicPattern) return false
    try {
      return new RegExp(p.topicPattern).test(topic)
    } catch {
      return false
    }
  })
  if (!matching) return null

  try {
    const headers: Record<string, string> = {}
    for (const h of msg.headers ?? []) {
      headers[h.key] = h.value
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function('value', 'key', 'headers', matching.script)
    const result = fn(msg.value, msg.key, headers)
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  } catch (e) {
    return `[plugin "${matching.name}" error: ${e}]`
  }
}
