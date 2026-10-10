import type { Plugin, ViewCreator } from 'obsidian'

export const LLK_PROJECT_VIEW_TYPE = 'low-level-kanban-project'
export const LLK_PROJECT_OVERVIEW_VIEW_TYPE = 'low-level-kanban-project-overview'
export const LLK_PROJECT_EDIT_VIEW_TYPE = 'low-level-kanban-project-edit'
export const LLK_DASHBOARD_VIEW_TYPE = 'low-level-kanban-dashboard'
export const LLK_TASK_VIEW_TYPE = 'low-level-kanban-task'
export const LLK_STYLEGUIDE_VIEW_TYPE = 'low-level-kanban-styleguide'

// Old workspace tabs use the same views. Their getViewType() writes the new ID.
const LEGACY_VIEW_TYPES = {
  [LLK_PROJECT_VIEW_TYPE]: 'pm-project',
  [LLK_PROJECT_OVERVIEW_VIEW_TYPE]: 'pm-project-overview',
  [LLK_PROJECT_EDIT_VIEW_TYPE]: 'pm-project-edit',
  [LLK_DASHBOARD_VIEW_TYPE]: 'pm-dashboard',
  [LLK_TASK_VIEW_TYPE]: 'pm-task',
  [LLK_STYLEGUIDE_VIEW_TYPE]: 'pm-styleguide'
} as const

export function registerViewWithLegacyAlias(
  plugin: Pick<Plugin, 'registerView'>,
  type: keyof typeof LEGACY_VIEW_TYPES,
  create: ViewCreator
): void {
  plugin.registerView(type, create)
  plugin.registerView(LEGACY_VIEW_TYPES[type], create)
}
