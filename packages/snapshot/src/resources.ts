import type { Project, ResolvedProjectConfig, Task } from '@low-level-kanban/core'
import { makeTask } from '@low-level-kanban/core'
import type { ProjectResource, ProjectSummary, TaskResource } from './types'

export function toTaskResource(task: Task, projectId: string, parentId: string | null, position: number): TaskResource {
  return {
    id: task.id,
    projectId,
    parentId,
    position,
    path: task.filePath ?? '',
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    start: task.start,
    due: task.due,
    completed: task.completed,
    progress: task.progress,
    assignees: [...task.assignees],
    tags: [...task.tags],
    dependencies: [...task.dependencies],
    recurrence: task.recurrence ? { ...task.recurrence } : null,
    manualOrder: task.manualOrder ? { ...task.manualOrder } : undefined,
    customFields: { ...task.customFields },
    archived: task.archived === true,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }
}

/** Every task of a project in tree order, positions counted among siblings. */
export function taskResources(project: Project, projectId: string, includeArchived: boolean): TaskResource[] {
  const out: TaskResource[] = []
  const walk = (tasks: Task[], parentId: string | null): void => {
    tasks.forEach((task, position) => {
      if (task.archived && !includeArchived) return
      out.push(toTaskResource(task, projectId, parentId, position))
      walk(task.subtasks, task.id)
    })
  }
  walk(project.tasks, null)
  return out
}

export function toProjectResource(
  project: Project,
  config: ResolvedProjectConfig,
  summary: ProjectSummary
): ProjectResource {
  return {
    ...summary,
    description: project.description,
    teamMembers: [...project.teamMembers],
    customFields: config.customFields.map((field) => ({ ...field })),
    statuses: config.statuses.map((status) => ({ ...status })),
    priorities: config.priorities.map((priority) => ({ ...priority })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  }
}

/** Rebuilds the task tree a project holds from its flat resources, siblings in position order. */
export function tasksFromResources(resources: TaskResource[]): Task[] {
  const byId = new Map<string, Task>()
  for (const r of resources) {
    byId.set(
      r.id,
      makeTask({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        status: r.status,
        priority: r.priority,
        start: r.start,
        due: r.due,
        completed: r.completed,
        progress: r.progress,
        assignees: [...r.assignees],
        tags: [...r.tags],
        dependencies: [...r.dependencies],
        recurrence: r.recurrence ?? undefined,
        manualOrder: r.manualOrder ? { ...r.manualOrder } : undefined,
        customFields: { ...r.customFields },
        archived: r.archived,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        filePath: r.path || undefined
      })
    )
  }
  const roots: Task[] = []
  const sorted = [...resources].sort((a, b) => a.position - b.position)
  for (const r of sorted) {
    const task = byId.get(r.id)
    if (!task) continue
    const parent = r.parentId ? byId.get(r.parentId) : undefined
    if (parent) parent.subtasks.push(task)
    else roots.push(task)
  }
  return roots
}
