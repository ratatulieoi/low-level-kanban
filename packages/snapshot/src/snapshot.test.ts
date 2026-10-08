import { describe, expect, it } from 'vitest'
import { makeDefaultFilter, makeProject, makeTask } from '@dotpm/core'
import { taskResources, tasksFromResources } from './resources'
import { isSnapshot, normalizeSnapshot, SNAPSHOT_FORMAT, SNAPSHOT_VERSION, type Snapshot } from './snapshot'

describe('tasksFromResources', () => {
  it('rebuilds the tree in sibling order from flat resources', () => {
    const project = makeProject('P', 'Projects/P/P.md')
    const grandchild = makeTask({ id: 'g', title: 'Grandchild' })
    const child = makeTask({ id: 'c', title: 'Child', subtasks: [grandchild], due: '2030-05-05' })
    project.tasks = [
      makeTask({ id: 'a', title: 'A', subtasks: [child], tags: ['x'], recurrence: { interval: 'weekly', every: 1 } }),
      makeTask({ id: 'b', title: 'B', archived: true, timeLogs: [{ date: '2030-01-01', hours: 2, note: '' }] })
    ]
    const flat = taskResources(project, 'pid', true)
    const rebuilt = tasksFromResources([...flat].reverse())
    expect(rebuilt.map((t) => t.id)).toEqual(['a', 'b'])
    expect(rebuilt[0].subtasks.map((t) => t.id)).toEqual(['c'])
    expect(rebuilt[0].subtasks[0].subtasks.map((t) => t.id)).toEqual(['g'])
    expect(rebuilt[0].recurrence).toEqual({ interval: 'weekly', every: 1 })
    expect(rebuilt[0].subtasks[0].due).toBe('2030-05-05')
    expect(rebuilt[1].archived).toBe(true)
    expect(rebuilt[1].timeLogs).toEqual([{ date: '2030-01-01', hours: 2, note: '' }])
    expect(taskResources({ ...project, tasks: rebuilt }, 'pid', true)).toEqual(flat)
  })
})

describe('normalizeSnapshot', () => {
  function legacySnapshot(mode: unknown): Snapshot {
    return {
      format: SNAPSHOT_FORMAT,
      version: 1,
      generator: { name: 'dotpm', version: '0' },
      exportedAt: '',
      locale: 'en',
      title: 'Legacy board',
      primaryProjectId: 'p',
      projects: [],
      icons: {},
      personColors: { Alice: '#c47070' },
      view: {
        mode,
        filter: { statuses: ['todo'], showArchived: true },
        sortKey: 'due',
        sortDir: 'desc',
        group: { field: 'priority', columns: { priority: { order: ['high'], hidden: ['low'] } } },
        fields: { table: { visible: ['title'], widths: { title: 200 } } },
        ganttGranularity: 'month',
        nonWorkingDays: { weekends: true }
      },
      settings: {
        priorityIcons: 'chevrons',
        showTagColors: true,
        showSubtreeConnections: true,
        lineBorders: 'none',
        dateFormat: '',
        ganttWeekLabel: 'weekNumber',
        holidays: ['2030-01-01'],
        kanbanShowSubtasks: true
      }
    } as unknown as Snapshot
  }

  it.each(['table', 'gantt', 'kanban', undefined, 'unknown'])('reads legacy mode %s as Kanban', (mode) => {
    const original = legacySnapshot(mode)
    const page = normalizeSnapshot(original)
    expect(page.view.mode).toBe('kanban')
    expect(page.view.filter).toEqual({
      conditions: [{ field: 'status', op: 'any', value: ['todo'] }],
      showArchived: true
    })
    expect(page.view.sort).toEqual([{ key: 'due', dir: 'desc' }])
    expect(page.view.group).toEqual(original.view.group)
    expect(page.view.fields?.kanban?.visible).toContain('subtasks')
    expect(Object.keys(page.view)).toEqual(['mode', 'filter', 'sort', 'group', 'fields'])
    expect(page.view.fields).not.toHaveProperty('table')
    expect(Object.keys(page.settings)).toEqual([
      'priorityIcons',
      'showTagColors',
      'showSubtreeConnections',
      'lineBorders',
      'dateFormat'
    ])
    expect(page.personColors).toEqual(original.personColors)
    expect(page.projects).toBe(original.projects)
    expect(original.view.mode).toBe(mode)
  })

  it('keeps explicit board fields and current filters instead of applying the legacy subtask setting', () => {
    const page = legacySnapshot('gantt')
    page.version = 2
    page.view.fields = { kanban: { visible: ['due', 'cf:client'] } }
    page.view.filter = makeDefaultFilter()
    page.view.sort = []
    const normalized = normalizeSnapshot(page)
    expect(normalized.view.fields).toEqual(page.view.fields)
    expect(normalized.view.filter).toEqual(makeDefaultFilter())
    expect(normalized.view.sort).toEqual([])
    expect(normalizeSnapshot(normalized)).toEqual(normalized)
  })
})

describe('isSnapshot', () => {
  it('accepts the current format and nothing else', () => {
    expect(isSnapshot({ format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION, projects: [] })).toBe(true)
    expect(isSnapshot({ format: SNAPSHOT_FORMAT, version: 1, projects: [] })).toBe(true)
    expect(isSnapshot({ format: SNAPSHOT_FORMAT, version: 99, projects: [] })).toBe(false)
    expect(isSnapshot({ format: 'other', version: SNAPSHOT_VERSION, projects: [] })).toBe(false)
    expect(isSnapshot(null)).toBe(false)
    expect(isSnapshot('nope')).toBe(false)
  })
})
