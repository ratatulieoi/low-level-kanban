import type { App } from 'obsidian'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  makeDefaultFilter,
  makeDefaultGroup,
  makeTask,
  type LowLevelKanbanSettings
} from '@low-level-kanban/core'
import {
  isSnapshot,
  normalizeSnapshot,
  tasksFromResources,
  type ReadableSnapshot,
  type Snapshot
} from '@low-level-kanban/snapshot'
import { makeFakeApp } from '#test/fakeVault'
import type LowLevelKanbanPlugin from '#main'
import { ProjectScope } from '#store/ProjectScope'
import { ProjectStore } from '#store/ProjectStore'
import { VaultIndex } from '#store/VaultIndex'
import { renderSnapshotHtml } from './html'
import { buildSnapshot, type ExportViewState } from './snapshot'

const SETTINGS: LowLevelKanbanSettings = { ...DEFAULT_SETTINGS, autoSchedule: false }
const TEMPLATE =
  '<html lang="__LOW_LEVEL_KANBAN_LOCALE__"><title>__LOW_LEVEL_KANBAN_TITLE__</title><script id="low-level-kanban-snapshot" type="application/json">__LOW_LEVEL_KANBAN_SNAPSHOT__</script>'

function fakePlugin(): { plugin: LowLevelKanbanPlugin; store: ProjectStore; index: VaultIndex } {
  const { app } = makeFakeApp({ liveMetadataCache: true })
  const typed = app as unknown as App
  const index = new VaultIndex(typed, () => SETTINGS)
  const store = new ProjectStore(typed, () => SETTINGS, index)
  const plugin = {
    app: typed,
    index,
    store,
    settings: SETTINGS,
    manifest: { version: '9.9.9' }
  } as unknown as LowLevelKanbanPlugin
  return { plugin, store, index }
}

describe('buildSnapshot', () => {
  let plugin: LowLevelKanbanPlugin
  let scope: ProjectScope

  beforeEach(async () => {
    const fake = fakePlugin()
    plugin = fake.plugin
    const project = await fake.store.createProject('Roadmap <b>', 'Projects')
    await fake.store.insertTask(
      project,
      makeTask({
        id: 'a',
        title: 'Alpha',
        description: 'Body of alpha',
        start: '2030-01-15',
        due: '2030-02-01',
        dependencies: ['prior-task'],
        customFields: { client: 'Example' }
      })
    )
    await fake.store.insertTask(project, makeTask({ id: 'a1', title: 'Alpha child', status: 'done' }), 'a')
    fake.index.build()
    scope = new ProjectScope({ kind: 'project', path: project.filePath }, [project], fake.store)
  })

  it('carries the projects, the tasks with bodies, the view state and the icon table', async () => {
    const snapshot = await buildSnapshot(plugin, scope, {
      mode: 'kanban',
      filter: { ...makeDefaultFilter(), conditions: [{ field: 'status', op: 'any', value: ['todo'] }] },
      sort: [{ key: 'due', dir: 'desc' }],
      group: { field: 'priority', columns: { priority: { hidden: ['low'] } } },
      fields: { kanban: { visible: ['due', 'cf:client'] } }
    })
    expect(isSnapshot(snapshot)).toBe(true)
    expect(snapshot.title).toBe('Roadmap <b>')
    expect(snapshot.format).toBe('low-level-kanban-snapshot')
    expect(snapshot.generator).toEqual({ name: 'Low Level Kanban', version: '9.9.9' })
    expect(snapshot.view).toMatchObject({
      mode: 'kanban',
      sort: [{ key: 'due', dir: 'desc' }],
      group: { field: 'priority', columns: { priority: { hidden: ['low'] } } },
      fields: { kanban: { visible: ['due', 'cf:client'] } }
    })
    expect(snapshot.view.filter.conditions).toEqual([{ field: 'status', op: 'any', value: ['todo'] }])
    expect(snapshot.projects.length).toBe(1)
    const [project] = snapshot.projects
    expect(project.taskCount).toBe(2)
    expect(project.doneCount).toBe(1)
    expect(project.statuses.map((s) => s.id)).toEqual(SETTINGS.statuses.map((s) => s.id))
    expect(project.tasks.map((t) => [t.id, t.parentId])).toEqual([
      ['a', null],
      ['a1', 'a']
    ])
    expect(project.tasks[0].description).toBe('Body of alpha')
    expect(typeof snapshot.icons).toBe('object')
    const html = renderSnapshotHtml(snapshot, TEMPLATE)
    const open = 'application/json">'
    const json = html.slice(html.indexOf(open) + open.length, html.lastIndexOf('</script>'))
    const restored = normalizeSnapshot(JSON.parse(json) as Snapshot)
    expect(restored).toEqual(snapshot)
    const tasks = tasksFromResources(restored.projects[0].tasks)
    expect(tasks[0]).toMatchObject({
      start: '2030-01-15',
      due: '2030-02-01',
      dependencies: ['prior-task'],
      customFields: { client: 'Example' }
    })
    expect(tasks[0].subtasks[0].id).toBe('a1')
    expect(snapshot.view).not.toHaveProperty('ganttGranularity')
    expect(snapshot.view).not.toHaveProperty('nonWorkingDays')
    expect(snapshot.settings).not.toHaveProperty('ganttWeekLabel')
    expect(snapshot.settings).not.toHaveProperty('holidays')
  })

  it('carries the color each person note sets for the assignees', async () => {
    await plugin.app.vault.create('People/Jane Doe.md', '---\ncolor: "#c47070"\n---\n')
    await plugin.store.insertTask(
      scope.projects[0],
      makeTask({ id: 'b', title: 'Beta', assignees: ['[[Jane Doe]]', 'Sam Lee'] })
    )
    const snapshot = await buildSnapshot(plugin, scope, {
      mode: 'kanban',
      filter: makeDefaultFilter(),
      sort: [{ key: 'title', dir: 'asc' }],
      group: makeDefaultGroup(),
      fields: {}
    })
    expect(snapshot.personColors).toEqual({ '[[Jane Doe]]': '#c47070' })
  })

  it('drops obsolete display state even if a caller supplies a legacy export state', async () => {
    const snapshot = await buildSnapshot(plugin, scope, {
      mode: 'gantt',
      filter: makeDefaultFilter(),
      sort: [],
      group: makeDefaultGroup(),
      fields: { table: { visible: ['title'], widths: { title: 300 } }, kanban: { visible: ['due'] } },
      ganttGranularity: 'month',
      nonWorkingDays: { weekends: true }
    } as unknown as ExportViewState)
    expect(snapshot.view).toEqual({
      mode: 'kanban',
      filter: makeDefaultFilter(),
      sort: [],
      group: makeDefaultGroup(),
      fields: { kanban: { visible: ['due'] } }
    })
  })
})

describe('renderSnapshotHtml', () => {
  const snapshot = {
    format: 'dotpm-snapshot',
    version: 1,
    title: 'A & <B>',
    projects: [],
    icons: {},
    exportedAt: '',
    locale: 'en',
    generator: { name: 'dotpm', version: '0' },
    primaryProjectId: 'p',
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
    }
  } as ReadableSnapshot

  it('re-exports a legacy snapshot with the new format, generator and script ID', () => {
    const html = renderSnapshotHtml(snapshot, TEMPLATE)
    expect(html).toContain('id="low-level-kanban-snapshot"')
    expect(html).toContain('"format":"low-level-kanban-snapshot"')
    expect(html).toContain('"generator":{"name":"Low Level Kanban","version":"0"}')
    expect(html).not.toContain('dotpm')
    expect(html).not.toContain('__LOW_LEVEL_KANBAN_')
    expect(snapshot.format).toBe('dotpm-snapshot')
  })

  it('escapes the title and keeps task text from closing the script tag', () => {
    const html = renderSnapshotHtml({ ...snapshot, title: 'A & <B> </script><script>alert(1)' }, TEMPLATE)
    expect(html).toContain('<title>A &amp; &lt;B&gt; &lt;/script&gt;&lt;script&gt;alert(1)</title>')
    const open = 'application/json">'
    const json = html.slice(html.indexOf(open) + open.length, html.lastIndexOf('</script>'))
    expect(json).not.toContain('</script>')
    expect(json).toContain('\\u003c/script>')
    expect(JSON.parse(json).title).toBe('A & <B> </script><script>alert(1)')
  })

  it('stamps the language of the export on the page', () => {
    expect(renderSnapshotHtml({ ...snapshot, locale: 'zh' }, TEMPLATE)).toContain('<html lang="zh">')
    expect(renderSnapshotHtml({ ...snapshot, locale: 'x"><b' }, TEMPLATE)).toContain('<html lang="x&quot;&gt;&lt;b">')
  })

  it('refuses to render without a viewer', () => {
    expect(() => renderSnapshotHtml(snapshot, '')).toThrow('viewer')
  })
})
