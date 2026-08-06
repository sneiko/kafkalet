import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import type { GlobalContainsFilter } from '@entities/message'
import { EMPTY_GLOBAL_FILTER } from '@entities/message'

interface Props {
  filter: GlobalContainsFilter
  onChange: (filter: GlobalContainsFilter) => void
  children: React.ReactNode
}

export function GlobalFilterPopover({ filter, onChange, children }: Props) {
  const handleClear = () => {
    onChange(EMPTY_GLOBAL_FILTER)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium">Filter Messages</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Search for text in message key or value
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground">Search in:</label>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="filter-target"
                  value="key"
                  checked={filter.target === 'key'}
                  onChange={() => onChange({ ...filter, target: 'key' })}
                  className="accent-primary"
                />
                <span>Key only</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="filter-target"
                  value="value"
                  checked={filter.target === 'value'}
                  onChange={() => onChange({ ...filter, target: 'value' })}
                  className="accent-primary"
                />
                <span>Value only</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="filter-target"
                  value="both"
                  checked={filter.target === 'both'}
                  onChange={() => onChange({ ...filter, target: 'both' })}
                  className="accent-primary"
                />
                <span>Both (Key or Value)</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Contains:</label>
            <Input
              value={filter.pattern}
              onChange={(e) => onChange({ ...filter, pattern: e.target.value })}
              placeholder="Type to search..."
              className="h-8 text-xs"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="filter-enabled"
              checked={filter.enabled}
              onChange={(e) => onChange({ ...filter, enabled: e.target.checked })}
              className="accent-primary"
            />
            <label htmlFor="filter-enabled" className="text-xs cursor-pointer select-none">
              Enable filter
            </label>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleClear}
            >
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}