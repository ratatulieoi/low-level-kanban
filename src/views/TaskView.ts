import { ItemView, Menu, Scope, WorkspaceLeaf } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import { addTabPageItems } from '#ui/tab'
import { type Task, flattenTasks, t } from '@low-level-kanban/core'
import { EmptyState } from '@low-level-kanban/ui'
import { TaskEditor } from '#modals/TaskEditor'

import { LLK_TASK_VIEW_TYPE } from './viewTypes'

/** `filePath` addresses an existing task note; a new task has only its project and parent. */
export interface TaskViewState {
  filePath?: string
  projectPath?: string
  parentId?: string | null
  defaults?: Partial<Task>
  [key: string]: unknown
}

export class TaskView extends ItemView {
  plugin: LowLevelKanbanPlugin
  private editor: TaskEditor | null = null
  private state: TaskViewState = {}
  private taskTitle = t('common.task')
  private keyScope: Scope

  constructor(leaf: WorkspaceLeaf, plugin: LowLevelKanbanPlugin) {
    super(leaf)
    this.plugin = plugin
    this.navigation = true
    this.keyScope = new Scope(this.app.scope)
    this.scope = this.keyScope
  }

  getViewType(): string {
    return LLK_TASK_VIEW_TYPE
  }
  getDisplayText(): string {
    return this.taskTitle
  }
  getIcon(): string {
    return 'square-check-big'
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source)
    const { filePath } = this.state
    if (!filePath || !this.editor) return
    addTabPageItems(menu, this.plugin, this.leaf, filePath, ['note'])
  }

  async setState(state: TaskViewState, result: unknown): Promise<void> {
    const same = state.filePath && state.filePath === this.state.filePath && this.editor
    this.state = state
    if (!same) await this.loadTask()
    await super.setState(state, result as import('obsidian').ViewStateResult)
  }

  getState(): TaskViewState {
    return this.state
  }

  onOpen(): Promise<void> {
    this.contentEl.addClass('llk-te-view', 'llk-te-surface')
    return Promise.resolve()
  }

  onClose(): Promise<void> {
    this.editor?.handleClose()
    this.editor = null
    this.contentEl.empty()
    return Promise.resolve()
  }

  private async loadTask(): Promise<void> {
    this.editor?.handleClose()
    this.editor = null
    this.contentEl.empty()

    const { filePath, projectPath, parentId, defaults } = this.state
    const resolvedProjectPath = projectPath ?? (filePath ? this.plugin.index.projectPathForTask(filePath) : null)
    const project = resolvedProjectPath ? await this.plugin.store.loadProjectByPath(resolvedProjectPath) : null
    if (!project) {
      this.showMissing(t('taskView.notInProject'))
      return
    }

    let task: Task | null = null
    if (filePath) {
      task = flattenTasks(project.tasks).find((f) => f.task.filePath === filePath)?.task ?? null
      if (!task) {
        this.showMissing(t('taskView.notTask', { project: project.title }))
        return
      }
      await this.plugin.store.loadTaskBody(task)
    }

    this.taskTitle = task?.title ?? t('taskView.newTask')
    this.editor = new TaskEditor(
      this.app,
      this.plugin,
      project,
      task,
      parentId ?? null,
      () => {},
      { surface: 'tab', close: () => this.leaf.detach(), scope: this.keyScope },
      defaults
    )
    this.editor.mount(this.contentEl)
  }

  private showMissing(message: string): void {
    this.taskTitle = t('common.task')
    new EmptyState(this.contentEl).setIcon('square-check-big').setTitle(t('taskView.missingTitle')).setBody(message)
  }
}
