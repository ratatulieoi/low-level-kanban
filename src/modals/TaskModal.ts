import { App, Modal } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import type { Project, Task } from '@low-level-kanban/core'
import { TaskEditor } from './TaskEditor'

export class TaskModal extends Modal {
  private editor: TaskEditor

  constructor(
    app: App,
    plugin: LowLevelKanbanPlugin,
    project: Project,
    task: Task | null,
    parentId: string | null,
    onSave: (task: Task) => void | Promise<void>,
    defaults?: Partial<Task>
  ) {
    super(app)
    this.editor = new TaskEditor(
      app,
      plugin,
      project,
      task,
      parentId,
      onSave,
      { surface: 'modal', close: () => this.close(), scope: this.scope },
      defaults
    )
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('llk-te-modal', 'llk-te-surface')
    this.modalEl.addClass('llk-modal', 'llk-modal--task')
    this.editor.mount(contentEl)
  }

  onClose(): void {
    this.editor.handleClose()
    this.contentEl.empty()
  }
}
