// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  makeDefaultFilter,
  makeDefaultGroup,
  makeTask,
  stringToColor,
  type ResolvedProjectConfig
} from '@dotpm/core'
import { boardTaskCount, boardTasks, type ViewModel } from './model'
import { renderSnapshotKanban } from './snapshotKanban'

const CONFIG: ResolvedProjectConfig = {
  statuses: DEFAULT_STATUSES,
  priorities: DEFAULT_PRIORITIES,
  priorityIcons: 'chevrons',
  customFields: [{ id: 'sprint', name: 'Sprint', type: 'text' }],
  defaultView: 'kanban',
  autoSchedule: false,
  pullForwardOnEarlyFinish: false,
  autoArchiveDays: 0,
  showSubtreeConnections: true,
  lineBorders: 'none'
}

function model(overrides: Partial<ViewModel> = {}): ViewModel {
  const child = makeTask({
    id: 'c',
    title: 'Child',
    type: 'subtask',
    status: 'in-progress',
    start: '2030-01-03',
    due: '2030-01-05',
    dependencies: ['a']
  })
  return {
    projects: [
      {
        id: 'p1',
        title: 'Alpha',
        color: '#8b72be',
        icon: '🚀',
        config: CONFIG,
        tasks: [
          makeTask({
            id: 'a',
            title: 'Parent',
            start: '2030-01-01',
            due: '2030-01-10',
            progress: 40,
            subtasks: [child],
            customFields: { sprint: 'S1' }
          }),
          makeTask({ id: 'm', title: 'Launch', type: 'milestone', due: '2030-01-12' }),
          makeTask({ id: 'z', title: 'Old', status: 'done', archived: true })
        ]
      },
      {
        id: 'p2',
        title: 'Beta',
        color: '#767491',
        icon: '📦',
        config: CONFIG,
        tasks: [makeTask({ id: 'b', title: 'Beta task', status: 'done', due: '2030-02-01' })]
      }
    ],
    settings: { priorityIcons: 'chevrons', showTagColors: true },
    filter: makeDefaultFilter(),
    sort: [{ key: 'title', dir: 'asc' }],
    group: makeDefaultGroup(),
    fields: {},
    personColors: {},
    ...overrides
  }
}

const cardIds = (host: HTMLElement): string[] =>
  Array.from(host.querySelectorAll<HTMLElement>('.pm-kanban-card')).map((card) => card.dataset.taskId ?? '')

afterEach(() => document.body.empty())

describe('snapshot kanban', () => {
  it('puts each task in its status column, in the order the view sorts by', () => {
    const host = document.body.createDiv()
    renderSnapshotKanban(host, model())
    const columns = host.querySelectorAll<HTMLElement>('.pm-kanban-col')
    expect(columns.length).toBe(DEFAULT_STATUSES.length)
    expect(cardIds(columns[0])).toEqual(['m', 'a'])
    expect(cardIds(host)).toEqual(['m', 'a', 'b'])
  })

  it('keeps the stored task order unchanged when sorting cards', () => {
    const view = model({ sort: [{ key: 'title', dir: 'desc' }] })
    const before = structuredClone(view)
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(cardIds(host)).toEqual(['a', 'm', 'b'])
    expect(view).toEqual(before)
  })

  it('colors assignees with the snapshot person colors and falls back to their names', () => {
    const view = model({ personColors: { '[[Jane Doe]]': '#c47070' } })
    view.projects[0].tasks[0].assignees = ['[[Jane Doe]]', 'Sam Lee']
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    const avatars = host.querySelectorAll<HTMLElement>('[data-task-id="a"] .pm-avatar')
    expect(avatars[0].style.getPropertyValue('--pm-avatar-color')).toBe('#c47070')
    expect(avatars[1].style.getPropertyValue('--pm-avatar-color')).toBe(stringToColor('Sam Lee'))
  })

  it('shows archived cards only when the filter asks', () => {
    expect(boardTasks(model()).map((task) => task.id)).not.toContain('z')
    const view = model({ filter: { ...makeDefaultFilter(), showArchived: true } })
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(cardIds(host)).toContain('z')
    expect(boardTaskCount(view)).toBe(4)
  })

  it('applies project and custom-field filters without losing task data', () => {
    const view = model({
      filter: {
        showArchived: false,
        conditions: [
          { field: 'project', op: 'any', value: ['p1'] },
          { field: 'cf:sprint', op: 'contains', value: 'S1' }
        ]
      }
    })
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(cardIds(host)).toEqual(['a'])
    expect(boardTaskCount(view)).toBe(1)
    expect(boardTasks(view)[0]).toBe(view.projects[0].tasks[0])
  })

  it('deals subtasks their own cards and keeps parent titles and custom fields', () => {
    const host = document.body.createDiv()
    const view = model({ fields: { kanban: { visible: ['subtasks', 'cf:sprint'] } } })
    renderSnapshotKanban(host, view)
    expect(host.querySelector('[data-task-id="c"] .pm-kanban-card-parent')?.textContent).toBe('Parent')
    expect(host.querySelector('[data-task-id="a"] .pm-kanban-card-field')?.textContent).toBe('SprintS1')
    expect(host.querySelector('.pm-kanban-card-footer')).toBeNull()
    expect(boardTaskCount(view)).toBe(4)
  })

  it('shows a matching subtask even when its parent does not match', () => {
    const view = model({
      fields: { kanban: { visible: ['subtasks'] } },
      filter: { showArchived: false, conditions: [{ field: 'status', op: 'any', value: ['in-progress'] }] }
    })
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(cardIds(host)).toEqual(['c'])
    expect(boardTaskCount(view)).toBe(1)
  })

  it('formats custom dates and descriptions in the chosen card field order', () => {
    const view = model({ fields: { kanban: { visible: ['cf:review', 'description', 'cf:sprint'] } } })
    view.projects[0].config = {
      ...CONFIG,
      customFields: [...CONFIG.customFields, { id: 'review', name: 'Review', type: 'date' }]
    }
    view.projects[0].tasks[0].customFields.review = '2030-01-20'
    view.projects[0].tasks[0].description = '**Review** the [draft](https://example.com)'
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    const fields = host.querySelectorAll(
      '[data-task-id="a"] .pm-kanban-card-field, [data-task-id="a"] .pm-kanban-card-description'
    )
    expect(Array.from(fields).map((field) => field.textContent)).toEqual([
      'ReviewJan 20, 30',
      'Review the draft',
      'SprintS1'
    ])
  })

  it('keeps project source chips on boards covering several projects', () => {
    const host = document.body.createDiv()
    renderSnapshotKanban(host, model())
    expect(host.querySelector('[data-task-id="a"] .pm-kanban-card-footer')?.textContent).toContain('Alpha')
    expect(host.querySelector('[data-task-id="b"] .pm-kanban-card-footer')?.textContent).toContain('Beta')
  })

  it('follows column order and hides the columns the view leaves out', () => {
    const host = document.body.createDiv()
    const view = model({
      fields: { kanban: { visible: ['subtasks'] } },
      group: { field: 'type', columns: { type: { order: ['milestone', 'task'], hidden: ['subtask'] } } }
    })
    renderSnapshotKanban(host, view)
    expect(Array.from(host.querySelectorAll<HTMLElement>('.pm-kanban-col')).map((col) => col.dataset.column)).toEqual([
      'milestone',
      'task'
    ])
    expect(cardIds(host)).toEqual(['m', 'b', 'a'])
    expect(boardTaskCount(view)).toBe(3)
  })

  it('counts each task once when grouping puts its card in several columns', () => {
    const view = model({ group: { field: 'assignee' } })
    view.projects[0].tasks[0].assignees = ['Ada', 'Bo']
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(cardIds(host).filter((id) => id === 'a')).toHaveLength(2)
    expect(boardTaskCount(view)).toBe(3)

    view.group.columns = { assignee: { hidden: ['Ada'] } }
    expect(boardTaskCount(view)).toBe(3)
    view.group.columns.assignee.hidden = ['Ada', 'Bo']
    expect(boardTaskCount(view)).toBe(2)
    view.group.columns.assignee.hidden.push('')
    expect(boardTaskCount(view)).toBe(0)
  })

  it('returns an empty board and zero tasks for an empty project scope', () => {
    const view = model({ projects: [] })
    const host = document.body.createDiv()
    renderSnapshotKanban(host, view)
    expect(host.querySelector('.pm-kanban-board')).not.toBeNull()
    expect(cardIds(host)).toEqual([])
    expect(boardTasks(view)).toEqual([])
    expect(boardTaskCount(view)).toBe(0)
  })
})
