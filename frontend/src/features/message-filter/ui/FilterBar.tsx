import { X } from 'lucide-react'
import { Input } from '@/shared/ui/input'
import type { FilterState } from '../lib/filter'

interface Props {
  filter: FilterState
  onChange: (filter: FilterState) => void
}

export function FilterBar({ filter, onChange }: Props) {
  const hasFilter = Boolean(filter.key || filter.value)

  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3 py-1 shrink-0">
      <span className="text-xs text-muted-foreground shrink-0">Filter</span>
      <Input
        value={filter.key}
        onChange={(e) => onChange({ ...filter, key: e.target.value })}
        placeholder="key regex…"
        className="h-6 text-xs font-mono flex-1"
      />
      <Input
        value={filter.value}
        onChange={(e) => onChange({ ...filter, value: e.target.value })}
        placeholder="value regex…"
        className="h-6 text-xs font-mono flex-1"
      />
      {hasFilter && (
        <button
          onClick={() => onChange({ key: '', value: '' })}
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Clear filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
