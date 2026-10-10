import type { CustomFieldDef, ViewFields, ViewMode } from '../types'
import { t } from '../i18n'

/** Board card fields in their default order. Custom fields follow as `cf:<id>`. */
const BUILT_IN = ['priority', 'description', 'tags', 'progress', 'project', 'assignees', 'due']
const HIDDEN_BY_DEFAULT = new Set(['description'])

/** What decides which fields exist: the custom fields in scope, and whether it spans projects. */
export interface FieldCatalog {
  customFields: CustomFieldDef[]
  multi: boolean
}

export function availableFields(_mode: ViewMode, catalog: FieldCatalog): string[] {
  const builtIn = BUILT_IN.filter((id) => id !== 'project' || catalog.multi)
  return [...builtIn, ...catalog.customFields.map((cf) => `cf:${cf.id}`)]
}

export function defaultFields(mode: ViewMode, catalog: FieldCatalog): string[] {
  return availableFields(mode, catalog).filter((id) => !id.startsWith('cf:') && !HIDDEN_BY_DEFAULT.has(id))
}

/** All available fields in user-customized order, falling back to default order. */
export function orderedFields(fields: ViewFields, mode: ViewMode, catalog: FieldCatalog): string[] {
  const available = availableFields(mode, catalog)
  const storedOrder = fields.kanban?.order
  if (!storedOrder) return available
  const result = storedOrder.filter((id) => available.includes(id))
  for (const id of available) {
    if (!result.includes(id)) result.push(id)
  }
  return result
}

/** What the board shows, in order, without fields that no longer exist. */
export function shownFields(fields: ViewFields, mode: ViewMode, catalog: FieldCatalog): string[] {
  const available = availableFields(mode, catalog)
  const stored = fields.kanban?.visible
  if (fields.kanban?.order) {
    const visibleSet = new Set(stored ?? defaultFields(mode, catalog))
    return fields.kanban.order.filter((id) => available.includes(id) && visibleSet.has(id))
  }
  return stored ? stored.filter((id) => available.includes(id)) : defaultFields(mode, catalog)
}

/** `shown` with `id` back where `order` puts it among them. */
export function withFieldShown<T extends string>(shown: readonly T[], id: T, order: readonly T[]): T[] {
  const rank = order.indexOf(id)
  const at = shown.findIndex((other) => order.indexOf(other) > rank)
  return at === -1 ? [...shown, id] : [...shown.slice(0, at), id, ...shown.slice(at)]
}

export function hiddenFields(fields: ViewFields, mode: ViewMode, catalog: FieldCatalog): string[] {
  const shown = shownFields(fields, mode, catalog)
  return availableFields(mode, catalog).filter((id) => !shown.includes(id))
}

/** Drops retired modes before reading the catalog, then omits an unchanged board field list. */
export function tidyFields(fields: ViewFields, catalog: FieldCatalog): void {
  for (const mode of Object.keys(fields)) {
    if (mode !== 'kanban') Reflect.deleteProperty(fields, mode)
  }
  const list = fields.kanban
  if (!list) return
  Reflect.deleteProperty(list, 'widths')
  if (!Array.isArray(list.visible)) {
    delete fields.kanban
    return
  }
  const shown = shownFields(fields, 'kanban', catalog)
  const defaults = defaultFields('kanban', catalog)
  const defaultOrder = availableFields('kanban', catalog)
  const isDefaultOrder =
    !list.order || (list.order.length === defaultOrder.length && list.order.every((id, i) => id === defaultOrder[i]))
  if (list.order && isDefaultOrder) {
    delete list.order
  }
  if (shown.length === defaults.length && shown.every((id, i) => id === defaults[i]) && isDefaultOrder) {
    delete fields.kanban
  }
}

/** Board fields from before the description switch joined the field picker. */
export function legacyBoardFields(showSubtasks: boolean, showDescription: boolean): ViewFields {
  if (!showDescription) return {}
  const visible = BUILT_IN.filter((id) => !HIDDEN_BY_DEFAULT.has(id) || (id === 'description' && showDescription))
  return { kanban: { visible } }
}

/** A field's name in the Fields popover. */
export function viewFieldLabel(id: string, customFields: CustomFieldDef[]): string {
  if (id.startsWith('cf:')) return customFields.find((cf) => `cf:${cf.id}` === id)?.name ?? id.slice(3)
  switch (id) {
    case 'project':
      return t('columns.project')
    case 'priority':
      return t('columns.priority')
    case 'assignees':
      return t('columns.assignees')
    case 'due':
      return t('columns.due')
    case 'progress':
      return t('columns.progress')
    case 'tags':
      return t('taskForm.tags')
    case 'description':
      return t('fields.description')
    default:
      return id
  }
}
