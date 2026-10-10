import { DEFAULT_STATUSES, type ViewMode } from './types'
import { hydrateFields, hydrateFilter } from './store/YamlHydrator'
import { legacyBoardFields } from './store/ViewFields'

const OBSOLETE_SETTINGS = [
  'localApiEnabled',
  'localApiPort',
  'localApiToken',
  'showReleaseNotes',
  'lastSeenVersion',
  'ganttGranularity',
  'ganttWeekLabel',
  'holidays',
  'nonWorkingDays',
  'ganttHideDone',
  'kanbanShowSubtasks',
  'kanbanShowDescriptionPreview'
] as const

/** Keeps saved view identity and intent while removing retired presentation state. */
export function normalizeBoardView<T extends object>(
  view: T
): Omit<T, 'viewMode' | 'ganttGranularity' | 'nonWorkingDays'> & {
  viewMode: ViewMode
} {
  const cleaned = { ...view, viewMode: 'kanban' as const }
  for (const key of ['ganttGranularity', 'nonWorkingDays']) Reflect.deleteProperty(cleaned, key)
  if ('fields' in cleaned) cleaned.fields = hydrateFields(cleaned.fields)
  return cleaned
}

/** Drops retired settings on load and save without discarding unrelated or unknown keys. */
export function omitObsoleteSettings<T extends object>(settings: T): Omit<T, (typeof OBSOLETE_SETTINGS)[number]> {
  const cleaned = { ...settings } as Record<string, unknown>
  for (const key of OBSOLETE_SETTINGS) Reflect.deleteProperty(cleaned, key)
  if ('defaultView' in cleaned) cleaned.defaultView = 'kanban'
  if ('defaultFields' in cleaned) cleaned.defaultFields = hydrateFields(cleaned.defaultFields)

  const saved = settings as Record<string, unknown>
  if ('kanbanShowDescriptionPreview' in saved) {
    const fields = hydrateFields(cleaned.defaultFields)
    if (fields.kanban) {
      const visible = fields.kanban.visible
      const field = 'description'
      const at = visible.indexOf(field)
      if (saved.kanbanShowDescriptionPreview && at === -1) visible.push(field)
      if (!saved.kanbanShowDescriptionPreview && at !== -1) visible.splice(at, 1)
      cleaned.defaultFields = fields
    } else {
      cleaned.defaultFields = legacyBoardFields(false, !!saved.kanbanShowDescriptionPreview)
    }
  }

  if (cleaned.projectFilters && typeof cleaned.projectFilters === 'object') {
    const statuses: unknown[] =
      Array.isArray(saved.statuses) && saved.statuses.length ? saved.statuses : DEFAULT_STATUSES
    const nonTerminal = statuses
      .filter(
        (status): status is { id: string; complete?: boolean } =>
          status !== null &&
          typeof status === 'object' &&
          'id' in status &&
          typeof status.id === 'string' &&
          (!('complete' in status) || status.complete === undefined || typeof status.complete === 'boolean')
      )
      .filter((status) => !(status.complete ?? ['done', 'cancelled'].includes(status.id)))
      .map((status) => status.id)
    cleaned.projectFilters = Object.fromEntries(
      Object.entries(cleaned.projectFilters).map(([key, entry]) => {
        const view = normalizeBoardView(entry)
        if (saved.ganttHideDone === true) {
          const filter = hydrateFilter(view.filter)
          if (!filter.conditions.some((condition) => condition.field === 'status')) {
            filter.conditions.push({ field: 'status', op: 'any', value: nonTerminal })
          }
          view.filter = filter
        }
        return [key, view]
      })
    )
  }
  if (cleaned.scopeViews && typeof cleaned.scopeViews === 'object') {
    cleaned.scopeViews = Object.fromEntries(
      Object.entries(cleaned.scopeViews).map(([key, views]) => [
        key,
        Array.isArray(views) ? views.map(normalizeBoardView) : views
      ])
    )
  }
  return cleaned as Omit<T, (typeof OBSOLETE_SETTINGS)[number]>
}
