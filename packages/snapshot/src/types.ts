import type { CustomFieldDef, PriorityConfig, Recurrence, StatusConfig, TaskType } from '@low-level-kanban/core'

/** Project metadata and counts captured in an exported view. */
export interface ProjectSummary {
  id: string
  path: string
  title: string
  icon: string
  color: string
  parentId: string | null
  /** Set on the project itself or inherited from an archived ancestor. */
  archived: boolean
  taskCount: number
  doneCount: number
}

export interface ProjectResource extends ProjectSummary {
  description: string
  teamMembers: string[]
  customFields: CustomFieldDef[]
  statuses: StatusConfig[]
  priorities: PriorityConfig[]
  createdAt: string
  updatedAt: string
}

export interface TaskResource {
  id: string
  projectId: string
  parentId: string | null
  /** Index among its siblings. */
  position: number
  path: string
  title: string
  description: string
  type: TaskType
  status: string
  priority: string
  start: string
  due: string
  completed: string
  progress: number
  assignees: string[]
  tags: string[]
  dependencies: string[]
  recurrence: Recurrence | null
  manualOrder?: Record<string, number>
  customFields: Record<string, unknown>
  archived: boolean
  createdAt: string
  updatedAt: string
}
