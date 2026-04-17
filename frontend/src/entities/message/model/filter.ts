export interface OffsetFilter {
  partition: string
  offsetMin: string
  offsetMax: string
}

export interface TimestampFilter {
  from: string
  to: string
}

export interface ColumnFilterState {
  offset: OffsetFilter
  timestamp: TimestampFilter
  key: string
  value: string
}

export const EMPTY_COLUMN_FILTER: ColumnFilterState = {
  offset: { partition: '', offsetMin: '', offsetMax: '' },
  timestamp: { from: '', to: '' },
  key: '',
  value: '',
}

export function isOffsetFilterActive(f: OffsetFilter): boolean {
  return f.partition.trim() !== '' || f.offsetMin.trim() !== '' || f.offsetMax.trim() !== ''
}

export function isTimestampFilterActive(f: TimestampFilter): boolean {
  return f.from.trim() !== '' || f.to.trim() !== ''
}
