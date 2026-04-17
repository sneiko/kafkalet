import { Input } from '@/shared/ui/input'
import type { ColumnFilterState, OffsetFilter, TimestampFilter, SortField } from '@entities/message'

interface Props {
  field: SortField
  filter: ColumnFilterState
  onChange: (next: ColumnFilterState) => void
}

export function FilterInputs({ field, filter, onChange }: Props) {
  switch (field) {
    case 'partition-offset':
      return <OffsetInputs value={filter.offset} onChange={(v) => onChange({ ...filter, offset: v })} />
    case 'timestamp':
      return <TimestampInputs value={filter.timestamp} onChange={(v) => onChange({ ...filter, timestamp: v })} />
    case 'key':
      return <TextInput value={filter.key} onChange={(v) => onChange({ ...filter, key: v })} placeholder="key (regex)…" />
    case 'value':
      return <TextInput value={filter.value} onChange={(v) => onChange({ ...filter, value: v })} placeholder="value (regex)…" />
  }
}

function OffsetInputs({
  value,
  onChange,
}: {
  value: OffsetFilter
  onChange: (v: OffsetFilter) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        value={value.partition}
        onChange={(e) => onChange({ ...value, partition: e.target.value })}
        placeholder="partition (e.g. 0)"
        className="h-6 text-xs font-mono"
        inputMode="numeric"
      />
      <div className="flex gap-1">
        <Input
          value={value.offsetMin}
          onChange={(e) => onChange({ ...value, offsetMin: e.target.value })}
          placeholder="offset ≥"
          className="h-6 text-xs font-mono flex-1"
          inputMode="numeric"
        />
        <Input
          value={value.offsetMax}
          onChange={(e) => onChange({ ...value, offsetMax: e.target.value })}
          placeholder="offset ≤"
          className="h-6 text-xs font-mono flex-1"
          inputMode="numeric"
        />
      </div>
    </div>
  )
}

function TimestampInputs({
  value,
  onChange,
}: {
  value: TimestampFilter
  onChange: (v: TimestampFilter) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-muted-foreground">
        From
        <Input
          type="datetime-local"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-6 text-xs font-mono mt-0.5"
        />
      </label>
      <label className="text-[10px] text-muted-foreground">
        To
        <Input
          type="datetime-local"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-6 text-xs font-mono mt-0.5"
        />
      </label>
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-6 text-xs font-mono"
    />
  )
}
