import type { FilterState, GroupState, SavedView, SortRule, ViewFields, ViewMode } from '../types'

/** What a view is showing right now, in the terms a saved view stores. */
export interface ViewState {
  filter: FilterState
  sort: SortRule[]
  group: GroupState
  fields: ViewFields
  mode: ViewMode
}

export type ViewPart = 'filter' | 'sort' | 'group' | 'fields' | 'mode'

/** JSON with object keys in a fixed order, so two equal values always compare equal. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  )
}

export function sameValue(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

/**
 * The parts of `state` that differ from `view`. A view that names no grouping, fields,
 * or mode doesn't care which one is showing.
 */
export function viewDifferences(view: SavedView, state: ViewState): ViewPart[] {
  const parts: ViewPart[] = []
  if (!sameValue(view.filter, state.filter)) parts.push('filter')
  if (!sameValue(view.sort, state.sort)) parts.push('sort')
  if (view.group && !sameValue(view.group, state.group)) parts.push('group')
  if (view.fields && !sameValue(view.fields, state.fields)) parts.push('fields')
  if (view.viewMode && view.viewMode !== state.mode) parts.push('mode')
  return parts
}

/** The views with the star on `id` alone, or on none when `id` is null. */
export function withDefault<T extends { id: string; isDefault?: boolean }>(views: T[], id: string | null): T[] {
  return views.map((view) => {
    const copy = { ...view }
    delete copy.isDefault
    if (view.id === id) copy.isDefault = true
    return copy
  })
}
