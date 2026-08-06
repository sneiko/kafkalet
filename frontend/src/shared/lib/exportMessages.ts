import type { KafkaMessage } from '@entities/message'
import { SaveTextFile } from '@shared/api'

/**
 * Writes content to a file chosen via the native OS save dialog.
 * Blob/anchor downloads do not work inside the WebKit webview, so exporting
 * must go through the bound Go method instead.
 */
function save(filename: string, content: string) {
  return SaveTextFile(filename, content)
}

export function exportAsJson(messages: KafkaMessage[], topic: string) {
  const data = JSON.stringify(messages, null, 2)
  return save(`${topic}-${Date.now()}.json`, data)
}

export function exportAsCsv(messages: KafkaMessage[], topic: string) {
  const escape = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const header = 'partition,offset,timestamp,key,value,headers'
  const rows = messages.map((m) =>
    [
      m.partition,
      m.offset,
      escape(m.timestamp),
      escape(m.key),
      escape(m.value),
      escape(JSON.stringify(m.headers)),
    ].join(','),
  )
  return save(`${topic}-${Date.now()}.csv`, [header, ...rows].join('\n'))
}
