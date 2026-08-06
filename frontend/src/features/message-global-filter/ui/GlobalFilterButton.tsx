import { Filter } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/ui/icon-button'
import { GlobalFilterPopover } from './GlobalFilterPopover'
import type { GlobalContainsFilter } from '@entities/message'
import { isGlobalFilterActive } from '@entities/message'

interface Props {
  filter: GlobalContainsFilter
  onChange: (filter: GlobalContainsFilter) => void
  disabled?: boolean
}

export function GlobalFilterButton({ filter, onChange, disabled }: Props) {
  const active = isGlobalFilterActive(filter)

  return (
    <GlobalFilterPopover filter={filter} onChange={onChange}>
      <IconButton
        variant="ghost"
        size="icon"
        className={cn('h-6 w-6', active && 'bg-accent text-accent-foreground')}
        tooltip="Filter messages"
        disabled={disabled}
      >
        <Filter className="h-3.5 w-3.5" />
      </IconButton>
    </GlobalFilterPopover>
  )
}