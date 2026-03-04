import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react'

import type { RateSnapshot, TopicRate } from '@entities/consumer-group'
import { StartRateWatcher, StopRateWatcher, EventsOn, EventsOff } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
}

export function MessageRatePanel({ profileId, brokerId }: Props) {
  const [rates, setRates] = useState<TopicRate[]>([])
  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    const eventName = `rate:${brokerId}`
    let cancelled = false

    StartRateWatcher(profileId, brokerId).then(() => {
      if (cancelled) return
      EventsOn(eventName, (snap: RateSnapshot) => {
        if (snap?.topics) {
          const sorted = [...snap.topics].sort((a, b) => b.messagesPerSec - a.messagesPerSec)
          setRates(sorted)
          setWaiting(false)
        }
      })
    }).catch(() => {
      // ignore — no data
    })

    return () => {
      cancelled = true
      EventsOff(eventName)
      StopRateWatcher()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, brokerId])

  if (waiting) {
    return (
      <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Waiting for first snapshot (~30s)…
      </div>
    )
  }

  if (rates.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">No topics found.</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="pb-1 text-left font-normal">Topic</th>
          <th className="pb-1 text-right font-normal">msg/s</th>
          <th className="pb-1 text-right font-normal">Total LEO</th>
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => (
          <tr key={r.topic} className="border-b border-border/30">
            <td className="py-0.5 font-mono text-muted-foreground max-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {r.topic}
            </td>
            <td className="py-0.5 text-right tabular-nums">
              <span className="inline-flex items-center gap-0.5 justify-end">
                {r.messagesPerSec > 0 ? (
                  <TrendingUp className="h-2.5 w-2.5 text-green-500" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 text-muted-foreground/50" />
                )}
                {r.messagesPerSec.toFixed(2)}
              </span>
            </td>
            <td className="py-0.5 text-right tabular-nums text-muted-foreground">
              {r.totalMessages.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
