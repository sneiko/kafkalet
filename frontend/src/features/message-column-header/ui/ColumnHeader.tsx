import { ArrowDown, ArrowUp, ChevronDown, Filter } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Separator } from '@/shared/ui/separator'
import type {
  ColumnFilterState,
  SortField,
  SortState,
} from '@entities/message'
import { FilterInputs } from './FilterInputs'
import {
  findSortIndex,
  getSortForColumn,
  removeColumnSort,
  toggleColumnSort,
} from '../lib/sortForColumn'
import { isColumnFilterActive, resetColumnFilter } from '../lib/resetFilter'

interface Props {
  label: string
  field: SortField
  sort: SortState
  filter: ColumnFilterState
  onSortChange: (next: SortState) => void
  onFilterChange: (next: ColumnFilterState) => void
}

export function ColumnHeader({
  label,
  field,
  sort,
  filter,
  onSortChange,
  onFilterChange,
}: Props) {
  const columnSort = getSortForColumn(sort, field)
  const sortIndex = findSortIndex(sort, field)
  const filterActive = isColumnFilterActive(filter, field)
  const SortArrow =
    columnSort?.direction === 'asc'
      ? ArrowUp
      : columnSort?.direction === 'desc'
        ? ArrowDown
        : null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-1 text-left text-[10px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground',
            (columnSort || filterActive) && 'text-foreground',
          )}
        >
          <span className="truncate">{label}</span>
          {filterActive && <Filter className="h-3 w-3" />}
          {SortArrow && <SortArrow className="h-3 w-3" />}
          {sort.length > 1 && sortIndex >= 0 && (
            <span className="tabular-nums">{sortIndex + 1}</span>
          )}
          <ChevronDown className="ml-auto h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-2">
          <FilterInputs field={field} filter={filter} onChange={onFilterChange} />

          <Separator />

          <div className="flex flex-col gap-0.5">
            <SortItem
              active={columnSort?.direction === 'asc'}
              icon={<ArrowUp className="h-3 w-3" />}
              label="Sort ascending"
              onClick={() => onSortChange(toggleColumnSort(sort, field, 'asc'))}
            />
            <SortItem
              active={columnSort?.direction === 'desc'}
              icon={<ArrowDown className="h-3 w-3" />}
              label="Sort descending"
              onClick={() => onSortChange(toggleColumnSort(sort, field, 'desc'))}
            />
            {columnSort && (
              <SortItem
                active={false}
                icon={null}
                label="Clear sort"
                onClick={() => onSortChange(removeColumnSort(sort, field))}
              />
            )}
            {filterActive && (
              <SortItem
                active={false}
                icon={null}
                label="Clear filter"
                onClick={() => onFilterChange(resetColumnFilter(filter, field))}
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SortItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-xs text-left transition-colors hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
