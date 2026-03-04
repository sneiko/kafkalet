import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { CreateTopic } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

export function CreateTopicDialog({ profileId, brokerId, open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState('1')
  const [replicationFactor, setReplicationFactor] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      await CreateTopic(profileId, brokerId, {
        name: trimmed,
        partitions: parseInt(partitions, 10) || 1,
        replicationFactor: parseInt(replicationFactor, 10) || 1,
      })
      setName('')
      setPartitions('1')
      setReplicationFactor('1')
      onCreated()
      onOpenChange(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setName('')
      setPartitions('1')
      setReplicationFactor('1')
      setError(null)
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Topic</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic-name">Topic Name</Label>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-topic"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="partitions">Partitions</Label>
              <Input
                id="partitions"
                type="number"
                min={1}
                value={partitions}
                onChange={(e) => setPartitions(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="replication">Replication Factor</Label>
              <Input
                id="replication"
                type="number"
                min={1}
                value={replicationFactor}
                onChange={(e) => setReplicationFactor(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
