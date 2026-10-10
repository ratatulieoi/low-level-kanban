import { TFile, type ViewState, type WorkspaceLeaf } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import type { ScopeSpec } from '#store'
import type { TaskViewState } from './TaskView'
import {
  LLK_DASHBOARD_VIEW_TYPE,
  LLK_PROJECT_EDIT_VIEW_TYPE,
  LLK_PROJECT_OVERVIEW_VIEW_TYPE,
  LLK_PROJECT_VIEW_TYPE,
  LLK_TASK_VIEW_TYPE
} from './viewTypes'

export class LowLevelKanbanViewRouter {
  constructor(private plugin: LowLevelKanbanPlugin) {}

  /** Pass a leaf to navigate within it instead of opening a tab. */
  private async open(type: string, state: Record<string, unknown>, leaf?: WorkspaceLeaf): Promise<void> {
    const ws = this.plugin.app.workspace
    const target = leaf ?? ws.getLeaf('tab')
    await target.setViewState({ type, state })
    if (!leaf) await ws.revealLeaf(target)
  }

  async openDashboard(): Promise<void> {
    await this.open(LLK_DASHBOARD_VIEW_TYPE, {})
  }

  async openProject(file: TFile): Promise<void> {
    await this.openScope({ kind: 'project', path: file.path })
  }

  async openScope(scope: ScopeSpec, leaf?: WorkspaceLeaf): Promise<void> {
    await this.open(LLK_PROJECT_VIEW_TYPE, { scope }, leaf)
  }

  async openProjectOverview(path: string, leaf?: WorkspaceLeaf): Promise<void> {
    await this.open(LLK_PROJECT_OVERVIEW_VIEW_TYPE, { filePath: path }, leaf)
  }

  /** Where a project link lands, per the open projects in setting. */
  projectLinkViewState(path: string): ViewState {
    if (this.plugin.settings.projectSurface === 'tasks') {
      return { type: LLK_PROJECT_VIEW_TYPE, state: { scope: { kind: 'project', path } } }
    }
    return { type: LLK_PROJECT_OVERVIEW_VIEW_TYPE, state: { filePath: path } }
  }

  async openProjectLink(path: string, leaf?: WorkspaceLeaf): Promise<void> {
    const { type, state } = this.projectLinkViewState(path)
    await this.open(type, state ?? {}, leaf)
  }

  async openProjectEdit(path: string, leaf?: WorkspaceLeaf): Promise<void> {
    await this.open(LLK_PROJECT_EDIT_VIEW_TYPE, { filePath: path }, leaf)
  }

  async openTask(state: TaskViewState): Promise<void> {
    await this.open(LLK_TASK_VIEW_TYPE, state)
  }

  async openProjectByPath(path: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path)
    if (file instanceof TFile) await this.openProject(file)
  }
}
