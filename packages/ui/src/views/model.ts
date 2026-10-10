import {
  type CustomFieldDef,
  type FilterContext,
  type FilterState,
  type GroupState,
  type TaskQuery,
  type PriorityConfig,
  type PriorityIconSet,
  type ResolvedProjectConfig,
  type SortRule,
  type StatusConfig,
  type Task,
  type FieldCatalog,
  type ViewFields,
  displayName,
  flattenTasks,
  mergeById,
  matchesQuery,
  shownFields
} from '@low-level-kanban/core'
import type { AvatarPerson } from '../primitives/AvatarStack'
import type { FilterSetup } from '../composites/ViewHeader/filterPopover'
import { boardCandidates } from './boardCards'
import { boardColumns } from './boardColumns'
import { compareTasks } from './tableSort'

export interface ViewProject {
  id: string
  title: string
  color: string
  icon: string
  tasks: Task[]
  config: ResolvedProjectConfig
}

export interface ViewSettings {
  priorityIcons: PriorityIconSet
  showTagColors: boolean
}

/**
 * Everything the read-only board needs, resolved by whoever holds the data: the plugin
 * from a scope, a page from a snapshot. Projects come primary first.
 */
export interface ViewModel {
  sort: SortRule[]
  group: GroupState
  fields: ViewFields
  projects: ViewProject[]
  settings: ViewSettings
  filter: FilterState
  /** A person value, as stored, to the color its note sets. */
  personColors: Record<string, string>
}

export function personOf(model: ViewModel, raw: string): AvatarPerson {
  return { name: displayName(raw), color: model.personColors[raw] }
}

export function isMulti(model: ViewModel): boolean {
  return model.projects.length > 1
}

export function allTasks(model: ViewModel): Task[] {
  return model.projects.flatMap((project) => project.tasks)
}

/** Filtered board candidates, sorted before multi-value grouping can duplicate their cards. */
export function boardTasks(model: ViewModel): Task[] {
  if (!model.projects.length) return []
  const config = mergedConfig(model)
  const fields = shownFields(model.fields, 'kanban', fieldCatalogOf(model))
  const query = queryOf(model)
  const ctx = filterContextOf(model)
  return boardCandidates(allTasks(model), fields)
    .filter((task) => matchesQuery(task, query, ctx))
    .sort((a, b) => compareTasks(a, b, model.sort, config.statuses, config.priorities))
}

/** Unique filtered tasks in visible board columns, respecting the card's subtask setting. */
export function boardTaskCount(model: ViewModel): number {
  const tasks = boardTasks(model)
  if (!tasks.length) return 0
  const columns = boardColumns(filterSetupOf(model), model.group, tasks)
  return new Set(columns.filter((column) => !column.hidden).flatMap((column) => column.tasks.map((task) => task.id)))
    .size
}

export function projectOf(model: ViewModel, taskId: string): ViewProject | null {
  for (const project of model.projects) {
    if (flattenTasks(project.tasks).some((f) => f.task.id === taskId)) return project
  }
  return null
}

export function configOf(model: ViewModel, taskId: string): ResolvedProjectConfig {
  return projectOf(model, taskId)?.config ?? mergedConfig(model)
}

/** Statuses and priorities of every project merged by id, primary first, for columns and headers. */
export function mergedConfig(model: ViewModel): ResolvedProjectConfig {
  const base = model.projects[0].config
  if (!isMulti(model)) return base
  return {
    ...base,
    statuses: mergeById<StatusConfig>(model.projects.map((p) => p.config.statuses)),
    priorities: mergeById<PriorityConfig>(model.projects.map((p) => p.config.priorities))
  }
}

export function customFieldColumns(model: ViewModel): CustomFieldDef[] {
  if (!isMulti(model)) return model.projects[0].config.customFields
  return mergeById(model.projects.map((p) => p.config.customFields))
}

export function fieldCatalogOf(model: ViewModel): FieldCatalog {
  return { customFields: customFieldColumns(model), multi: isMulti(model) }
}

/** A page has no search box, so its query is the filter the export started from. */
export function queryOf(model: ViewModel): TaskQuery {
  return { filter: model.filter, text: '' }
}

export function filterContextOf(model: ViewModel): FilterContext {
  return {
    statuses: mergedConfig(model).statuses,
    customFields: customFieldColumns(model),
    projectOf: (task) => projectOf(model, task.id)?.id
  }
}

/** How the page names the values a board groups by: every task, the palettes, and the projects when there are several. */
export function filterSetupOf(model: ViewModel): FilterSetup {
  const config = mergedConfig(model)
  return {
    filter: model.filter,
    tasks: flattenTasks(allTasks(model)).map((flat) => flat.task),
    ctx: filterContextOf(model),
    priorities: config.priorities,
    priorityIcons: config.priorityIcons,
    projects: isMulti(model) ? model.projects.map((p) => ({ id: p.id, title: p.title, color: p.color })) : []
  }
}
