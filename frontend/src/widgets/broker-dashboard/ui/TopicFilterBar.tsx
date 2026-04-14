import { useMemo, useState, useCallback } from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'
import { Checkbox } from '@/shared/ui/checkbox'

export interface TopicFilterState {
  search: string
  regexEnabled: boolean
  regexError: boolean
  minPartitions: string
}

interface Props {
  value: TopicFilterState
  onChange: (state: TopicFilterState) => void
}

export function useTopicFilter() {
  const [search, setSearch] = useState('')
  const [regexEnabled, setRegexEnabled] = useState(false)
  const [minPartitions, setMinPartitions] = useState('')

  const regexError = useMemo(() => {
    if (!regexEnabled || !search) return false
    try {
      new RegExp(search)
      return false
    } catch {
      return true
    }
  }, [search, regexEnabled])

  const state: TopicFilterState = useMemo(
    () => ({ search, regexEnabled, regexError, minPartitions }),
    [search, regexEnabled, regexError, minPartitions],
  )

  const setState = useCallback((next: TopicFilterState) => {
    setSearch(next.search)
    setRegexEnabled(next.regexEnabled)
    setMinPartitions(next.minPartitions)
  }, [])

  return { filterState: state, setFilterState: setState }
}

export function TopicFilterBar({ value, onChange }: Props) {
  const { search, regexEnabled, regexError, minPartitions } = value

  const updateField = <K extends keyof TopicFilterState>(key: K, val: TopicFilterState[K]) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={regexEnabled ? 'Regex pattern...' : 'Search topics...'}
          value={search}
          onChange={(e) => updateField('search', e.target.value)}
          className={cn(
            'h-7 pl-7 text-xs',
            regexError && 'border-destructive focus-visible:ring-destructive',
          )}
        />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
        <Checkbox
          checked={regexEnabled}
          onCheckedChange={(v) => updateField('regexEnabled', v === true)}
          className="h-3.5 w-3.5"
        />
        Regex
      </label>
      <Input
        placeholder="Min partitions"
        type="number"
        min={0}
        value={minPartitions}
        onChange={(e) => updateField('minPartitions', e.target.value)}
        className="h-7 w-28 text-xs"
      />
    </>
  )
}
