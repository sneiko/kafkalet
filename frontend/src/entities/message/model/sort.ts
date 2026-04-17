export type SortField = 'partition-offset' | 'timestamp' | 'key' | 'value'
export type SortDirection = 'asc' | 'desc'

export interface SortKey {
  field: SortField
  direction: SortDirection
}

export type SortState = SortKey[]

export const DEFAULT_SORT: SortState = [{ field: 'partition-offset', direction: 'asc' }]
