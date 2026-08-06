import { useEffect, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { IconButton } from '@/shared/ui/icon-button'
import { Switch } from '@/shared/ui/switch'
import { GetTopicMessageCount, type broker } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
  topic: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CountMessagesDialog({ profileId, brokerId, topic, open, onOpenChange }: Props) {
  const [count, setCount] = useState<broker.TopicMessageCount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(true)

  const loadCount = async () => {
    setLoading(true)
    setError(null)
    try {
      const c = await GetTopicMessageCount(profileId, brokerId, topic, availableOnly)
      setCount(c)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadCount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, availableOnly])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              <span className="font-mono text-sm">{topic}</span>
            </DialogTitle>
            <IconButton
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={loadCount}
              disabled={loading}
              tooltip="Refresh"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </div>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {count && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {availableOnly ? 'Available messages only' : 'Total messages written'}
              </div>
              <Switch
                checked={availableOnly}
                onCheckedChange={(v: boolean) => setAvailableOnly(v)}
                aria-label="Toggle available messages only"
              />
            </div>

            <div className="p-3 bg-muted rounded-md">
              <div className="text-xs text-muted-foreground">
                {availableOnly ? 'Available Messages' : 'Total Messages Written'}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {count.total.toLocaleString()}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">By Partition</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-1 text-left font-normal">Partition</th>
                    <th className="pb-1 text-right font-normal">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {count.partitions.map((p) => (
                    <tr key={p.partition} className="border-b border-border/40">
                      <td className="py-1 tabular-nums">{p.partition}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">
                        {p.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !count && !error && (
          <p className="text-xs text-muted-foreground">No message count data available.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}