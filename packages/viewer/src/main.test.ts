// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES, makeDefaultFilter, setDateFormat } from '@low-level-kanban/core'
import type { Snapshot } from '@low-level-kanban/snapshot'
import { boardTaskCount } from '@low-level-kanban/ui'
import { iconFromMarkup, loadSnapshot, mount, readEmbeddedSnapshot, viewModelFromSnapshot } from './main'

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="svg-icon lucide-check"><path d="M1 1"/></svg>'

function snapshot(): Snapshot {
  return {
    format: 'low-level-kanban-snapshot',
    version: 2,
    generator: { name: 'Low Level Kanban', version: '0' },
    exportedAt: '2030-01-01T10:00:00.000Z',
    locale: 'en',
    title: 'Alpha',
    primaryProjectId: 'p1',
    view: {
      mode: 'kanban',
      filter: makeDefaultFilter(),
      sort: [{ key: 'title', dir: 'asc' }]
    },
    settings: {
      priorityIcons: 'chevrons',
      showTagColors: true,
      showSubtreeConnections: true,
      lineBorders: 'none',
      dateFormat: ''
    },
    projects: [
      {
        id: 'p1',
        path: 'Projects/Alpha/Alpha.md',
        title: 'Alpha',
        icon: 'rocket',
        color: '#8b72be',
        parentId: null,
        archived: false,
        taskCount: 2,
        doneCount: 1,
        description: '',
        teamMembers: [],
        customFields: [],
        statuses: DEFAULT_STATUSES,
        priorities: DEFAULT_PRIORITIES,
        createdAt: '2030-01-01T00:00:00.000Z',
        updatedAt: '2030-01-01T00:00:00.000Z',
        tasks: [
          task('a', 'First', null, 0, 'todo'),
          task('a1', 'First child', 'a', 0, 'done'),
          task('b', 'Second', null, 1, 'done')
        ]
      }
    ],
    icons: { check: ICON, rocket: ICON }
  }
}

function task(id: string, title: string, parentId: string | null, position: number, status: string) {
  return {
    id,
    projectId: 'p1',
    parentId,
    position,
    path: '',
    title,
    description: '',
    type: 'task' as const,
    status,
    priority: 'medium',
    start: '',
    due: '2030-02-01',
    completed: '',
    progress: 0,
    assignees: ['Alice'],
    tags: [],
    dependencies: [],
    recurrence: null,
    timeEstimate: null,
    timeLogs: [],
    customFields: {},
    archived: false,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z'
  }
}

describe('viewer', () => {
  beforeEach(() => {
    document.body.empty()
  })

  afterEach(() => {
    setDateFormat('')
    window.location.hash = ''
  })

  it('turns a snapshot into a view model with the task tree rebuilt', () => {
    const model = viewModelFromSnapshot(snapshot())
    expect(model.projects[0].tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(model.projects[0].tasks[0].subtasks.map((t) => t.id)).toEqual(['a1'])
    expect(model.projects[0].config.defaultView).toBe('kanban')
  })

  it.each([
    ['low-level-kanban-snapshot', 'low-level-kanban-snapshot', 2],
    ['dotpm-snapshot', 'dotpm-snapshot', 1],
    ['dotpm-snapshot', 'dotpm-snapshot', 2],
    ['low-level-kanban-snapshot', 'dotpm-snapshot', 2]
  ])('reads embedded script %s with format %s version %s', (id, format, version) => {
    const page = { ...snapshot(), format, version, generator: { name: 'dotpm', version: '0' } }
    const el = document.body.createEl('script', { attr: { id: String(id), type: 'application/json' } })
    el.textContent = JSON.stringify(page)
    const loaded = readEmbeddedSnapshot(document)
    expect(loaded?.format).toBe('low-level-kanban-snapshot')
    expect(loaded?.generator.name).toBe('Low Level Kanban')
    expect(loaded?.projects).toEqual(page.projects)
    expect(loaded?.view.mode).toBe('kanban')
  })

  it('reads the single sort key of a version 1 page', () => {
    const old = snapshot()
    old.version = 1
    Object.assign(old.view, { sort: undefined, sortKey: 'due', sortDir: 'desc' })
    expect(viewModelFromSnapshot(old).sort).toEqual([{ key: 'due', dir: 'desc' }])
  })

  it('reads the fields a page carries, and the subtask cards setting of a version 1 page', () => {
    const page = snapshot()
    page.view.fields = { kanban: { visible: ['due', 'assignees'] } }
    expect(viewModelFromSnapshot(page).fields).toEqual({ kanban: { visible: ['due', 'assignees'] } })
    const old = snapshot()
    old.version = 1
    old.settings.kanbanShowSubtasks = true
    expect(viewModelFromSnapshot(old).fields.kanban?.visible).toContain('subtasks')
  })

  it('reads the filter of a version 1 page, which held fixed facets', () => {
    const old = snapshot()
    old.version = 1
    old.view.filter = {
      statuses: ['todo'],
      dueDateFilter: 'overdue',
      showArchived: false
    } as unknown as Snapshot['view']['filter']
    expect(viewModelFromSnapshot(old).filter).toEqual({
      conditions: [
        { field: 'status', op: 'any', value: ['todo'] },
        { field: 'due', op: 'bucket', value: 'overdue' }
      ],
      showArchived: false
    })
  })

  it('mounts the header and board without a view selector', () => {
    const root = document.body.createDiv()
    mount(root, snapshot())
    expect(root.querySelector('.llk-snapshot-title')?.textContent).toBe('Alpha')
    expect(root.querySelector('.llk-snapshot-icon svg')).not.toBeNull()
    expect(root.querySelectorAll('.llk-kanban-card').length).toBe(2)
    expect(root.querySelector('.llk-view-switcher')).toBeNull()
    expect(root.querySelector('.llk-snapshot-meta')?.textContent).toContain('2 tasks')
  })

  it.each([
    [1, 'table'],
    [1, 'gantt'],
    [2, 'table'],
    [2, 'gantt'],
    [2, undefined]
  ] as const)('opens version %s mode %s as a board, ignoring legacy URL and override choices', (version, mode) => {
    const page = snapshot()
    page.version = version
    Object.assign(page.view, { mode })
    const el = document.body.createEl('script', { attr: { id: 'dotpm-snapshot', type: 'application/json' } })
    el.textContent = JSON.stringify(page)
    const loaded = readEmbeddedSnapshot(document)
    expect(loaded?.view.mode).toBe('kanban')
    expect(viewModelFromSnapshot(page).projects[0].config.defaultView).toBe('kanban')
    window.location.hash = `#${mode}`
    const root = document.body.createDiv()
    // Old JavaScript callers may still pass a third argument; it no longer selects a mode.
    Reflect.apply(mount, undefined, [root, page, { mode }])
    expect(root.querySelector('.llk-kanban-board')).not.toBeNull()
    expect(root.querySelector('.llk-view-switcher, .llk-table, .llk-gantt-view')).toBeNull()
  })

  it('counts filtered board tasks once across multiple visible groups', () => {
    const page = snapshot()
    page.projects[0].tasks[0].assignees = ['Alice', 'Bob']
    page.projects[0].tasks[2].assignees = ['Hidden']
    page.view.group = { field: 'assignee', columns: { assignee: { hidden: ['Hidden'] } } }
    const model = viewModelFromSnapshot(page)
    expect(boardTaskCount(model)).toBe(1)
    const root = document.body.createDiv()
    mount(root, page)
    expect(root.querySelectorAll('.llk-kanban-card').length).toBe(2)
    expect(root.querySelector('.llk-snapshot-meta')?.textContent).toContain('1 task')
    page.view.filter.conditions = [{ field: 'status', op: 'any', value: ['done'] }]
    expect(boardTaskCount(viewModelFromSnapshot(page))).toBe(0)
    page.view.group.columns = {}
    expect(boardTaskCount(viewModelFromSnapshot(page))).toBe(1)
  })

  it('counts subtask cards only when the board shows them, including version 1 settings', () => {
    const page = snapshot()
    expect(boardTaskCount(viewModelFromSnapshot(page))).toBe(2)
    page.version = 1
    page.settings.kanbanShowSubtasks = true
    expect(boardTaskCount(viewModelFromSnapshot(page))).toBe(3)
  })

  it('writes dates in the format the snapshot carries', () => {
    const root = document.body.createDiv()
    const exported = snapshot()
    exported.settings.dateFormat = 'DD.MM.YYYY'
    mount(root, exported)
    expect(root.querySelector('.llk-kanban-card')?.textContent).toContain('01.02.2030')
  })

  it('reads the embedded snapshot and rejects anything else', () => {
    const el = document.body.createEl('script', { attr: { id: 'dotpm-snapshot', type: 'application/json' } })
    el.textContent = JSON.stringify(snapshot()).replace(/</g, '\\u003c')
    expect(readEmbeddedSnapshot(document)?.title).toBe('Alpha')
    el.textContent = '{"format":"other"}'
    expect(readEmbeddedSnapshot(document)).toBeNull()
    el.textContent = '{'
    expect(readEmbeddedSnapshot(document)).toBeNull()
  })
})

describe('iconFromMarkup', () => {
  it('keeps the drawing and drops scripts, handlers and links', () => {
    const icon = iconFromMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)" class="svg-icon">' +
        '<script>alert(2)</script><a href="https://example.com"><path d="M0 0"/></a>' +
        '<g transform="scale(2)"><path d="M1 1" onclick="alert(3)" stroke-width="2"/></g></svg>'
    )
    expect(icon?.outerHTML).toBe(
      '<svg viewBox="0 0 24 24" class="svg-icon"><g transform="scale(2)"><path d="M1 1" stroke-width="2"></path></g></svg>'
    )
  })

  it('refuses markup that is not an svg', () => {
    expect(iconFromMarkup('<html><body onload="alert(1)"></body></html>')).toBeNull()
    expect(iconFromMarkup('not markup')).toBeNull()
  })
})

describe('loadSnapshot', () => {
  beforeEach(() => {
    document.body.empty()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function hostedRoot(url: string): void {
    document.body.createDiv({ attr: { id: 'app', 'data-snapshot': url } })
  }

  it('fetches the snapshot the root points at when none is embedded', async () => {
    hostedRoot('/eu/alpha/b/abc')
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(snapshot())))
    vi.stubGlobal('fetch', fetchMock)
    expect((await loadSnapshot(document))?.title).toBe('Alpha')
    expect(fetchMock).toHaveBeenCalledWith('/eu/alpha/b/abc')
  })

  it('normalizes a fetched legacy snapshot to Kanban', async () => {
    hostedRoot('/board.json')
    const page = snapshot()
    page.version = 1
    Object.assign(page.view, { mode: 'gantt', ganttGranularity: 'month' })
    page.settings.kanbanShowSubtasks = true
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(page)))
    const loaded = await loadSnapshot(document)
    expect(loaded?.view.mode).toBe('kanban')
    expect(loaded?.view.fields?.kanban?.visible).toContain('subtasks')
    expect(loaded?.view).not.toHaveProperty('ganttGranularity')
  })

  it('gives up on a failed fetch or anything that is not a snapshot', async () => {
    hostedRoot('/eu/alpha/b/abc')
    vi.stubGlobal('fetch', async () => new Response('gone', { status: 410 }))
    expect(await loadSnapshot(document)).toBeNull()
    vi.stubGlobal('fetch', async () => new Response('{"format":"other"}'))
    expect(await loadSnapshot(document)).toBeNull()
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline')
    })
    expect(await loadSnapshot(document)).toBeNull()
  })

  it('prefers the embedded snapshot and needs no network for it', async () => {
    hostedRoot('/eu/alpha/b/abc')
    const el = document.body.createEl('script', { attr: { id: 'dotpm-snapshot', type: 'application/json' } })
    el.textContent = JSON.stringify(snapshot())
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    expect((await loadSnapshot(document))?.title).toBe('Alpha')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
