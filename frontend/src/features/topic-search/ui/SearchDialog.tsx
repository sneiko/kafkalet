import { useState, useMemo } from 'react'
import { Loader2, Search } from 'lucide-react'

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
import { Checkbox } from '@/shared/ui/checkbox'

import { StartSearch } from '@shared/api'
import { useSearchStore } from '@entities/search'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function SearchDialog({
  profileId,
  brokerId,
  brokerName,
  topic,
  open,
  onOpenChange,
}: Props) {
  const [keyPattern, setKeyPattern] = useState('')
  const [valuePattern, setValuePattern] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [timestampFrom, setTimestampFrom] = useState('')
  const [timestampTo, setTimestampTo] = useState('')
  const [maxResults, setMaxResults] = useState('1000')
  const [maxScan, setMaxScan] = useState('1000000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSession = useSearchStore((s) => s.addSession)

  const hasPattern = keyPattern.trim() !== '' || valuePattern.trim() !== ''

  const regexError = useMemo(() => {
    if (!useRegex) return null
    try {
      if (keyPattern) new RegExp(keyPattern)
      if (valuePattern) new RegExp(valuePattern)
      return null
    } catch (e) {
      return String(e)
    }
  }, [keyPattern, valuePattern, useRegex])

  const handleStart = async () => {
    if (!hasPattern) {
      setError('At least one pattern (key or value) is required')
      return
    }
    if (regexError) {
      setError(regexError)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const req = {
        topic,
        keyPattern: keyPattern.trim(),
        valuePattern: valuePattern.trim(),
        partitions: [] as number[],
        timestampFrom: timestampFrom ? new Date(timestampFrom).getTime() : undefined,
        timestampTo: timestampTo ? new Date(timestampTo).getTime() : undefined,
        maxResults: parseInt(maxResults, 10) || 1000,
        maxScan: parseInt(maxScan, 10) || 1_000_000,
        useRegex,
      }

      const sessionId = await StartSearch(profileId, brokerId, req as any)
      addSession({
        id: sessionId,
        profileId,
        brokerId,
        brokerName,
        topic,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Search Topic
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Topic</p>
            <p className="text-sm font-medium font-mono">{topic}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Key Pattern</Label>
            <Input
              placeholder={useRegex ? 'Regex pattern...' : 'Substring...'}
              value={keyPattern}
              onChange={(e) => setKeyPattern(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Value Pattern</Label>
            <Input
              placeholder={useRegex ? 'Regex pattern...' : 'Substring...'}
              value={valuePattern}
              onChange={(e) => setValuePattern(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={useRegex}
              onCheckedChange={(v) => setUseRegex(v === true)}
              className="h-3.5 w-3.5"
            />
            Use Regex
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From (optional)</Label>
              <Input
                type="datetime-local"
                value={timestampFrom}
                onChange={(e) => setTimestampFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To (optional)</Label>
              <Input
                type="datetime-local"
                value={timestampTo}
                onChange={(e) => setTimestampTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Max Results</Label>
              <Input
                type="number"
                min={1}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Scan</Label>
              <Input
                type="number"
                min={1}
                value={maxScan}
                onChange={(e) => setMaxScan(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={loading || !hasPattern || !!regexError}
          >
            {loading && <Loader2 className="animate-spin" />}
            Start Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
