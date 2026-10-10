import {
  type Task,
  appendBodyChecklist,
  deleteBodyChecklist,
  groupBodyChecklist,
  parseBodyChecklist,
  t,
  toggleBodyChecklist
} from '@low-level-kanban/core'
import { Checkbox, IconButton } from '@low-level-kanban/ui'

/** The header count is how many of the description's checklist lines are checked. */
export function renderSubtasksPanel(container: HTMLElement, task: Task, onChanged?: () => void): void {
  const grouped = groupBodyChecklist(task.description)
  if (grouped !== task.description) {
    task.description = grouped
    onChanged?.()
  }

  const subSection = container.createDiv('llk-modal-section')

  const subHeader = subSection.createDiv('llk-subtasks-header')
  const heading = subHeader.createEl('h4', { text: `${t('subtasks.heading')} `, cls: 'llk-modal-section-title' })
  const countEl = heading.createSpan({ cls: 'llk-subtasks-count' })

  const subList = subSection.createDiv('llk-modal-subtask-list')

  const renderCount = () => {
    const items = parseBodyChecklist(task.description)
    if (items.length === 0) {
      countEl.setText('')
      return
    }
    const done = items.filter((item) => item.done).length
    countEl.setText(`${done}/${items.length}`)
  }

  const renderSubtasks = () => {
    subList.empty()
    parseBodyChecklist(task.description).forEach((item, index) => {
      const row = subList.createDiv('llk-modal-subtask-row')

      const toggle = () => {
        task.description = toggleBodyChecklist(task.description, index)
        onChanged?.()
        renderSubtasks()
        renderCount()
      }

      new Checkbox(row)
        .setChecked(item.done)
        .setAriaLabel(t('subtasks.done', { title: item.text }))
        .onChange(toggle)

      // A checklist line is plain text in the note body, so there is no note to open.
      const cls = item.done ? 'llk-subtask-title llk-subtask-title--done' : 'llk-subtask-title'
      row.createSpan({ text: item.text, cls })

      new IconButton(row)
        .setIcon('x')
        .setTooltip(t('subtasks.remove'))
        .setRevealOnHover(true)
        .onClick(() => {
          task.description = deleteBodyChecklist(task.description, index)
          onChanged?.()
          renderSubtasks()
          renderCount()
        })

      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        if (target.closest('.llk-icon-btn') || target.closest('input[type="checkbox"]')) {
          return
        }
        toggle()
      })
    })
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
    task.description = appendBodyChecklist(task.description, title)
    addInput.value = ''
    onChanged?.()
    renderSubtasks()
    renderCount()
  })
}
