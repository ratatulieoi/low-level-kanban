import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  makeProject,
  makeTask,
  type ResolvedProjectConfig
} from '@low-level-kanban/core'
import { taskResources, toProjectResource, toTaskResource } from './resources'

const CONFIG: ResolvedProjectConfig = {
  statuses: DEFAULT_STATUSES,
  priorities: DEFAULT_PRIORITIES,
  priorityIcons: 'chevrons',
  customFields: [],
  defaultView: 'kanban',
  autoSchedule: false,
  pullForwardOnEarlyFinish: false,
  autoArchiveDays: 0,
  showSubtreeConnections: true,
  lineBorders: 'none'
}

describe('taskResources', () => {
  it('walks the tree with parent ids and sibling positions, skipping archived unless asked', () => {
    const project = makeProject('P', 'Projects/P/P.md')
    const child = makeTask({ id: 'c', title: 'Child' })
    const archived = makeTask({ id: 'z', title: 'Old', archived: true })
    project.tasks = [makeTask({ id: 'a', title: 'A', subtasks: [child] }), archived, makeTask({ id: 'b', title: 'B' })]
    const rows = taskResources(project, 'pid', false)
    expect(rows.map((r) => [r.id, r.parentId, r.position])).toEqual([
      ['a', null, 0],
      ['c', 'a', 0],
      ['b', null, 2]
    ])
    expect(taskResources(project, 'pid', true).map((r) => r.id)).toEqual(['a', 'c', 'z', 'b'])
    expect(rows[0].projectId).toBe('pid')
    expect(rows[0].archived).toBe(false)
  })

  it('copies task collections and represents missing optional fields as null', () => {
    const task = makeTask({ id: 'a', title: 'A', tags: ['tag'], customFields: { sprint: 3 } })
    const resource = toTaskResource(task, 'pid', null, 0)
    expect(resource.recurrence).toBeNull()
    expect(resource.path).toBe('')
    expect(resource.tags).toEqual(task.tags)
    expect(resource.tags).not.toBe(task.tags)
    expect(resource.customFields).toEqual(task.customFields)
    expect(resource.customFields).not.toBe(task.customFields)
  })
})

describe('toProjectResource', () => {
  it('captures project metadata and copies the resolved palettes', () => {
    const project = makeProject('P', 'Projects/P/P.md')
    const summary = {
      id: project.id,
      path: project.filePath,
      title: project.title,
      icon: project.icon,
      color: project.color,
      parentId: null,
      archived: false,
      taskCount: 2,
      doneCount: 1
    }
    const resource = toProjectResource(project, CONFIG, summary)
    expect(resource).toMatchObject({
      ...summary,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    })
    expect(resource.teamMembers).toEqual(project.teamMembers)
    expect(resource.teamMembers).not.toBe(project.teamMembers)
    expect(resource.statuses).toEqual(CONFIG.statuses)
    expect(resource.statuses[0]).not.toBe(CONFIG.statuses[0])
    expect(resource.priorities).toEqual(CONFIG.priorities)
    expect(resource.priorities[0]).not.toBe(CONFIG.priorities[0])
    expect(resource.customFields).toEqual(CONFIG.customFields)
    expect(resource.customFields).not.toBe(CONFIG.customFields)
  })
})
