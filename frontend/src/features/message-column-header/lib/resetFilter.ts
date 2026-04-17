import type { ColumnFilterState, SortField } from '@entities/message'
import {
  EMPTY_COLUMN_FILTER,
  isOffsetFilterActive,
  isTimestampFilterActive,
} from '@entities/message'

export function resetColumnFilter(
  filter: ColumnFilterState,
  field: SortField,
): ColumnFilterState {
  switch (field) {
    case 'partition-offset':
      return { ...filter, offset: EMPTY_COLUMN_FILTER.offset }
    case 'timestamp':
      return { ...filter, timestamp: EMPTY_COLUMN_FILTER.timestamp }
    case 'key':
      return { ...filter, key: '' }
    case 'value':
      return { ...filter, value: '' }
  }
}

export function isColumnFilterActive(
  filter: ColumnFilterState,
  field: SortField,
): boolean {
  switch (field) {
    case 'partition-offset':
      return isOffsetFilterActive(filter.offset)
    case 'timestamp':
      return isTimestampFilterActive(filter.timestamp)
    case 'key':
      return filter.key.trim() !== ''
    case 'value':
      return filter.value.trim() !== ''
  }
}
