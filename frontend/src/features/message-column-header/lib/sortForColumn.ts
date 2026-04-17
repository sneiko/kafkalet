import type { SortField, SortKey, SortState, SortDirection } from '@entities/message'

export function findSortIndex(sort: SortState, field: SortField): number {
  return sort.findIndex((k) => k.field === field)
}

export function getSortForColumn(sort: SortState, field: SortField): SortKey | undefined {
  return sort.find((k) => k.field === field)
}

/**
 * Toggle a column's sort direction. If the column isn't in the sort list yet,
 * append it with the given direction (becomes lowest priority). If it is,
 * update its direction in place (priority preserved).
 */
export function toggleColumnSort(
  sort: SortState,
  field: SortField,
  direction: SortDirection,
): SortState {
  const idx = findSortIndex(sort, field)
  if (idx < 0) return [...sort, { field, direction }]
  const next = sort.slice()
  next[idx] = { field, direction }
  return next
}

export function removeColumnSort(sort: SortState, field: SortField): SortState {
  return sort.filter((k) => k.field !== field)
}
