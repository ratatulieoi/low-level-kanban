import {
  type StatusConfig,
  type Task,
  makeTask,
  isTerminalStatus,
  getCompleteStatusId,
  getDefaultStatusId,
  t
} from '@low-level-kanban/core'
import { renderNoteLink, Checkbox, IconButton } from '@low-level-kanban/ui'

/** The header count is how many subtasks sit in a terminal status. */
export function renderSubtasksPanel(
  container: HTMLElement,
  task: Task,
  statuses: StatusConfig[],
  openSubtask: (filePath: string) => void
): void {
  const subSection = container.createDiv('llk-modal-section')

  const subHeader = subSection.createDiv('llk-subtasks-header')
  const heading = subHeader.createEl('h4', { text: `${t('subtasks.heading')} `, cls: 'llk-modal-section-title' })
  const countEl = heading.createSpan({ cls: 'llk-subtasks-count' })

  const subList = subSection.createDiv('llk-modal-subtask-list')

  const renderCount = () => {
    const total = task.subtasks.length
    if (total === 0) {
      countEl.setText('')
      return
    }
    const done = task.subtasks.filter((s) => isTerminalStatus(s.status, statuses)).length
    countEl.setText(`${done}/${total}`)
  }

  const renderSubtasks = () => {
    subList.empty()
    for (const sub of task.subtasks) {
      const row = subList.createDiv('llk-modal-subtask-row')

      const done = isTerminalStatus(sub.status, statuses)

      new Checkbox(row)
        .setChecked(done)
        .setAriaLabel(t('subtasks.done', { title: sub.title }))
        .onChange((checked) => {
          sub.status = checked ? getCompleteStatusId(statuses) : getDefaultStatusId(statuses)
          sub.progress = checked ? 100 : 0
          renderSubtasks()
          renderCount()
        })

      // A subtask typed into the add field below has no note yet, so there is nothing to
      // open until the editor saves.
      const cls = done ? 'llk-subtask-title llk-subtask-title--done' : 'llk-subtask-title'
      const filePath = sub.filePath
      if (filePath) {
        renderNoteLink(row, { label: sub.title, path: filePath, open: () => openSubtask(filePath), cls })
      } else {
        row.createSpan({ text: sub.title, cls })
      }

      new IconButton(row)
        .setIcon('x')
        .setTooltip(t('subtasks.remove'))
        .setRevealOnHover(true)
        .onClick(() => {
          task.subtasks = task.subtasks.filter((s) => s.id !== sub.id)
          renderSubtasks()
          renderCount()
        })
    }
  }

  renderSubtasks()
  renderCount()

  const addRow = subSection.createDiv('llk-modal-subtask-row llk-subtask-add-row')
  addRow.createSpan({ cls: 'llk-subtask-checkbox-ghost', attr: { 'aria-hidden': 'true' } })
  const addInput = addRow.createEl('input', {
    cls: 'llk-subtask-add-input',
    attr: { placeholder: t('subtasks.addPlaceholder') }
  })
  addInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const title = addInput.value.trim()
    if (!title) return
    task.subtasks.push(makeTask({ title, type: 'subtask' }))
    addInput.value = ''
    renderSubtasks()
    renderCount()
  })
}
