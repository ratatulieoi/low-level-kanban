import type { ViewCreator, WorkspaceLeaf } from 'obsidian'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@low-level-kanban/core'
import type LowLevelKanbanPlugin from '#main'
import { LowLevelKanbanViewRouter } from './LowLevelKanbanViewRouter'
import { ProjectView } from './ProjectView'
import { ProjectOverviewView } from './ProjectOverviewView'
import { ProjectEditView } from './ProjectEditView'
import { DashboardView } from './DashboardView'
import { TaskView } from './TaskView'
import { StyleguideView } from './styleguide/StyleguideView'
import {
  LLK_PROJECT_VIEW_TYPE,
  LLK_PROJECT_OVERVIEW_VIEW_TYPE,
  LLK_PROJECT_EDIT_VIEW_TYPE,
  LLK_DASHBOARD_VIEW_TYPE,
  LLK_TASK_VIEW_TYPE,
  LLK_STYLEGUIDE_VIEW_TYPE,
  registerViewWithLegacyAlias
} from './viewTypes'

vi.mock('obsidian', async (importOriginal) => ({
  ...(await importOriginal()),
  ItemView: class {
    app = { scope: {} }
  },
  Component: vi.fn<() => void>(),
  Scope: class {
    register(): void {}
  }
}))
vi.mock('#ui/ModalFactory', () => ({}))
vi.mock('#ui/TaskContextMenu', () => ({}))
vi.mock('#modals/TaskEditor', () => ({}))

describe('saved workspace view compatibility', () => {
  it.each([
    [LLK_PROJECT_VIEW_TYPE, 'pm-project', ProjectView],
    [LLK_PROJECT_OVERVIEW_VIEW_TYPE, 'pm-project-overview', ProjectOverviewView],
    [LLK_PROJECT_EDIT_VIEW_TYPE, 'pm-project-edit', ProjectEditView],
    [LLK_DASHBOARD_VIEW_TYPE, 'pm-dashboard', DashboardView],
    [LLK_TASK_VIEW_TYPE, 'pm-task', TaskView],
    [LLK_STYLEGUIDE_VIEW_TYPE, 'pm-styleguide', StyleguideView]
  ] as const)('registers %s and restores the legacy %s as a branded view', (current, legacy, View) => {
    const creators = new Map<string, ViewCreator>()
    const plugin = { registerView: (type: string, create: ViewCreator) => creators.set(type, create) }
    const create: ViewCreator = (leaf) => new View(leaf, {} as LowLevelKanbanPlugin)
    registerViewWithLegacyAlias(plugin, current, create)
    expect([...creators.keys()]).toEqual([current, legacy])
    expect(creators.get(legacy)).toBe(create)
    expect(creators.get(current)).toBe(create)
    const restore = creators.get(legacy)
    if (!restore) throw new Error('legacy factory missing')
    expect(restore({} as WorkspaceLeaf).getViewType()).toBe(current)
  })

  it('opens only branded IDs while preserving the task and project state', async () => {
    const leaf = { setViewState: vi.fn<WorkspaceLeaf['setViewState']>().mockResolvedValue(undefined) }
    const workspace = { getLeaf: () => leaf, revealLeaf: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) }
    const plugin = { app: { workspace }, settings: { ...DEFAULT_SETTINGS } } as unknown as LowLevelKanbanPlugin
    const router = new LowLevelKanbanViewRouter(plugin)
    const scope = { kind: 'project', path: 'Projects/Roadmap/Roadmap.md' } as const
    await router.openDashboard()
    await router.openScope(scope, leaf as unknown as WorkspaceLeaf)
    await router.openProjectOverview(scope.path)
    await router.openProjectEdit(scope.path)
    await router.openTask({ filePath: 'Projects/Roadmap/_tasks/task.md' })
    expect(leaf.setViewState.mock.calls.map(([state]) => state)).toEqual([
      { type: LLK_DASHBOARD_VIEW_TYPE, state: {} },
      { type: LLK_PROJECT_VIEW_TYPE, state: { scope } },
      { type: LLK_PROJECT_OVERVIEW_VIEW_TYPE, state: { filePath: scope.path } },
      { type: LLK_PROJECT_EDIT_VIEW_TYPE, state: { filePath: scope.path } },
      { type: LLK_TASK_VIEW_TYPE, state: { filePath: 'Projects/Roadmap/_tasks/task.md' } }
    ])
    plugin.settings.projectSurface = 'tasks'
    expect(router.projectLinkViewState(scope.path)).toEqual({ type: LLK_PROJECT_VIEW_TYPE, state: { scope } })
    plugin.settings.projectSurface = 'overview'
    expect(router.projectLinkViewState(scope.path)).toEqual({
      type: LLK_PROJECT_OVERVIEW_VIEW_TYPE,
      state: { filePath: scope.path }
    })
  })
})
