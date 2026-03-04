import type { KafkaMessage } from '@entities/message'

/** Triggers a browser download for the given content. */
function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsJson(messages: KafkaMessage[], topic: string) {
  const data = JSON.stringify(messages, null, 2)
  download(`${topic}-${Date.now()}.json`, data, 'application/json')
}

export function exportAsCsv(messages: KafkaMessage[], topic: string) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
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
  download(`${topic}-${Date.now()}.csv`, [header, ...rows].join('\n'), 'text/csv')
}
