import { useState } from 'react'
import { Loader2, Radio } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Input } from '@/shared/ui/input'

import { StartObserver, StartObserverAtTimestamp } from '@shared/api'
import { useSessionStore } from '@entities/session'

type StartMode = 'latest' | 'earliest' | 'timestamp'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ObserveDialog({
  profileId,
  brokerId,
  brokerName,
  topic,
  open,
  onOpenChange,
}: Props) {
  const [startMode, setStartMode] = useState<StartMode>('latest')
  const [timestamp, setTimestamp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSession = useSessionStore((s) => s.addSession)

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      let sessionId: string
      let displayOffset: string

      if (startMode === 'timestamp') {
        if (!timestamp) {
          setError('Select a timestamp')
          setLoading(false)
          return
        }
        const ms = new Date(timestamp).getTime()
        if (isNaN(ms)) {
          setError('Invalid timestamp')
          setLoading(false)
          return
        }
        sessionId = await StartObserverAtTimestamp(profileId, brokerId, topic, ms)
        displayOffset = `ts:${timestamp}`
      } else {
        sessionId = await StartObserver(profileId, brokerId, topic, startMode)
        displayOffset = startMode
      }

      addSession({
        id: sessionId,
        profileId,
        brokerId,
        brokerName,
        topic,
        startOffset: displayOffset,
        mode: 'observer',
      })
      onOpenChange(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Observe Topic
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Broker</p>
            <p className="text-sm font-medium">{brokerName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Topic</p>
            <p className="text-sm font-medium font-mono">{topic}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Start From</Label>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: 'latest', label: 'Latest', desc: 'From now (new messages only)' },
                  { value: 'earliest', label: 'From beginning', desc: 'Read all messages from offset 0' },
                  { value: 'timestamp', label: 'From date/time', desc: 'Seek to a specific point in time' },
                ] as const
              ).map(({ value: opt, label, desc }) => (
                <label key={opt} className="flex items-start gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    value={opt}
                    checked={startMode === opt}
                    onChange={() => setStartMode(opt)}
                    className="accent-primary mt-0.5"
                  />
                  <div>
                    <span className="text-sm">{label}</span>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {startMode === 'timestamp' && (
              <Input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleStart} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Start Observing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
