import type { App, WorkspaceLeaf } from 'obsidian'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  makeDefaultFilter,
  makeDefaultGroup,
  makeProject,
  t,
  type SavedView
} from '@low-level-kanban/core'
import type LowLevelKanbanPlugin from '#main'
import { makeFakeApp } from '#test/fakeVault'
import { ProjectScope } from '#store/ProjectScope'
import { ProjectStore } from '#store/ProjectStore'
import { ProjectView } from './ProjectView'

vi.mock('obsidian', async (importOriginal) => ({
  ...(await importOriginal()),
  ItemView: class {
    app = { scope: {} }
  },
  Scope: class {
    register(): void {}
  }
}))
vi.mock('#ui/ModalFactory', () => ({ openTaskModal: vi.fn() }))
vi.mock('#ui/TaskContextMenu', () => ({ buildTaskContextMenu: vi.fn() }))
vi.mock('../export/exportView', () => ({ exportViewAsHtml: vi.fn() }))

const savedView = (): SavedView => ({
  id: 'saved-board',
  name: 'Delivery',
  isDefault: true,
  viewMode: 'kanban',
  filter: {
    ...makeDefaultFilter(),
    conditions: [{ field: 'priority', op: 'any', value: ['high'] }]
  },
  sort: [{ key: 'due', dir: 'desc' }],
  group: { field: 'priority', columns: { priority: { hidden: ['low'], order: ['high', 'medium', 'low'] } } },
  fields: { kanban: { visible: ['description', 'due', 'cf:client', 'subtasks'] } }
})

describe('ProjectView board state', () => {
  let plugin: LowLevelKanbanPlugin
  let view: ProjectView

  beforeEach(() => {
    const settings = structuredClone(DEFAULT_SETTINGS)
    const { app } = makeFakeApp()
    const store = new ProjectStore(app as unknown as App, () => settings)
    plugin = {
      app,
      settings,
      store,
      saveSettings: vi.fn().mockResolvedValue(undefined)
    } as unknown as LowLevelKanbanPlugin
    view = new ProjectView({} as WorkspaceLeaf, plugin)
    const project = makeProject('Roadmap', 'Projects/Roadmap.md')
    view.projectScope = new ProjectScope({ kind: 'project', path: project.filePath }, [project], store)
    view['syncHeader'] = vi.fn()
  })

  it('exports only the retained board state, without sharing mutable state', () => {
    view['applySavedView'](savedView())
    const exported = view.exportState()

    expect(exported).toEqual({
      mode: 'kanban',
      filter: view.query.filter,
      sort: view.sort,
      group: view.group,
      fields: view.fields
    })
    exported.filter.conditions.splice(0)
    exported.sort.splice(0)
    exported.group.field = 'status'
    exported.fields.kanban?.visible.splice(0)
    expect(view.query.filter.conditions).toHaveLength(1)
    expect(view.sort).toHaveLength(1)
    expect(view.group.field).toBe('priority')
    expect(view.fields.kanban?.visible).toContain('description')
  })

  it('applies a saved view without losing hidden columns, custom fields or card descriptions', () => {
    const saved = savedView()
    view['applySavedView'](saved)

    expect(view.activeSavedViewId).toBe(saved.id)
    expect(view.query.filter).toEqual(saved.filter)
    expect(view.sort).toEqual(saved.sort)
    expect(view.group).toEqual(saved.group)
    expect(view.fields).toEqual(saved.fields)
    view.group.columns?.priority.hidden?.push('medium')
    view.fields.kanban?.visible.push('time')
    expect(saved.group?.columns?.priority.hidden).toEqual(['low'])
    expect(saved.fields?.kanban?.visible).not.toContain('time')
  })

  it('keeps current board fields and grouping when older saved views omit them', () => {
    view['applySavedView'](savedView())
    const group = structuredClone(view.group)
    const fields = structuredClone(view.fields)
    view['applySavedView']({ id: 'older', name: 'Older', filter: makeDefaultFilter(), sort: [] })

    expect(view.activeSavedViewId).toBe('older')
    expect(view.group).toEqual(group)
    expect(view.fields).toEqual(fields)
  })

  it('persists and restores scope state with the Kanban compatibility value', async () => {
    view['applySavedView'](savedView())
    await view['persistFilter']()
    const key = view.projectScope!.key
    expect(plugin.settings.projectFilters[key]).toEqual({
      filter: view.query.filter,
      activeSavedViewId: 'saved-board',
      sort: view.sort,
      group: view.group,
      fields: view.fields,
      viewMode: 'kanban'
    })
    view.fields = {}
    view.group = makeDefaultGroup()
    view['loadFilterFromSettings']()
    expect(view.fields).toEqual(savedView().fields)
    expect(view.group).toEqual(savedView().group)
    expect(plugin.saveSettings).toHaveBeenCalledOnce()
  })

  it('opens an untouched scope with its starred board', () => {
    view.project!.savedViews = [savedView()]
    view['loadFilterFromSettings']()

    expect(view.activeSavedViewId).toBe('saved-board')
    expect(view.fields).toEqual(savedView().fields)
    expect(view.group).toEqual(savedView().group)
  })

  it('saves a new starred view with board state and moves the previous star', async () => {
    const scope = new ProjectScope({ kind: 'vault' }, view.projectScope!.projects, plugin.store)
    view.projectScope = scope
    plugin.settings.scopeViews[scope.key] = [savedView()]
    view['applySavedView'](savedView())
    await view['handleSavedViewSave']('Release', true)

    const [previous, saved] = plugin.settings.scopeViews[scope.key]
    expect(previous).toEqual({ ...savedView(), isDefault: undefined })
    expect(saved).toEqual({ ...savedView(), id: view.activeSavedViewId, name: 'Release' })
    expect(saved.id).not.toBe(previous.id)
    expect(saved.fields).not.toBe(view.fields)
  })

  it('updates board state without changing the saved identity, name or star', async () => {
    const scope = new ProjectScope({ kind: 'vault' }, view.projectScope!.projects, plugin.store)
    view.projectScope = scope
    plugin.settings.scopeViews[scope.key] = [savedView()]
    view['applySavedView'](savedView())
    view.group.hideEmpty = true
    view.fields.kanban?.visible.push('time')
    expect(view['viewChanges']()).toEqual([t('header.changedGroup'), t('header.changedFields')])
    await view['handleSavedViewUpdate']('saved-board')

    expect(plugin.settings.scopeViews[scope.key][0]).toEqual({
      ...savedView(),
      group: view.group,
      fields: view.fields
    })
    expect(view['viewChanges']()).toEqual([])
  })

  it('offers only board query controls in narrow and phone Tune menus', () => {
    expect(
      view['tuneItems']()
        .flat()
        .map((item) => item.label)
    ).toEqual([t('header.search'), t('header.filter'), t('header.sort'), t('header.group'), t('header.fields')])
    expect(view['tuneSheet']().tabs.map((tab) => tab.id)).toEqual(['filter', 'sort', 'group', 'fields'])
    expect(view.getIcon()).toBe('kanban')
  })
})
