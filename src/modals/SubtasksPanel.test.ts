// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { makeTask, parseBodyChecklist } from '@low-level-kanban/core'
import { renderSubtasksPanel } from './SubtasksPanel'

describe('renderSubtasksPanel', () => {
  it('automatically groups unfinished subtasks on top when rendered', () => {
    const host = activeDocument.body.createDiv()
    const task = makeTask({
      title: 'Parent Task',
      description: '- [x] this\n- [ ] a\n- [x] test\n- [ ] and'
    })
    const onChanged = vi.fn<() => void>()

    renderSubtasksPanel(host, task, onChanged)

    // task.description should be grouped with unfinished items first
    expect(task.description).toBe('- [ ] a\n- [ ] and\n- [x] this\n- [x] test')
    expect(onChanged).toHaveBeenCalled()

    // Rows rendered in the UI should match the grouped order
    const rows = host.querySelectorAll('.llk-modal-subtask-row:not(.llk-subtask-add-row)')
    expect(rows).toHaveLength(4)
    expect(rows[0].querySelector('.llk-subtask-title')?.textContent).toBe('a')
    expect(rows[1].querySelector('.llk-subtask-title')?.textContent).toBe('and')
    expect(rows[2].querySelector('.llk-subtask-title')?.textContent).toBe('this')
    expect(rows[3].querySelector('.llk-subtask-title')?.textContent).toBe('test')
  })

  it('moves an unfinished subtask down to the bottom when checked', () => {
    const host = activeDocument.body.createDiv()
    const task = makeTask({
      title: 'Parent Task',
      description: '- [ ] a\n- [ ] and\n- [x] this\n- [x] test'
    })
    const onChanged = vi.fn<() => void>()

    renderSubtasksPanel(host, task, onChanged)

    const rows = host.querySelectorAll('.llk-modal-subtask-row:not(.llk-subtask-add-row)')
    // Click on row 0 ('a') to toggle it done
    const row0 = rows[0] as HTMLElement
    row0.click()

    // 'a' should have moved to the bottom of the list
    const items = parseBodyChecklist(task.description)
    expect(items.map((i) => i.text)).toEqual(['and', 'this', 'test', 'a'])
    expect(items.find((i) => i.text === 'a')?.done).toBe(true)

    // UI rows should re-render reflecting the new order
    const updatedRows = host.querySelectorAll('.llk-modal-subtask-row:not(.llk-subtask-add-row)')
    expect(updatedRows[0].querySelector('.llk-subtask-title')?.textContent).toBe('and')
    expect(updatedRows[3].querySelector('.llk-subtask-title')?.textContent).toBe('a')
  })

  it('moves a done subtask back up into the unfinished group when unchecked', () => {
    const host = activeDocument.body.createDiv()
    const task = makeTask({
      title: 'Parent Task',
      description: '- [ ] a\n- [x] this\n- [x] test'
    })
    const onChanged = vi.fn<() => void>()

    renderSubtasksPanel(host, task, onChanged)

    const rows = host.querySelectorAll('.llk-modal-subtask-row:not(.llk-subtask-add-row)')
    // Click on row 1 ('this' which is done)
    const row1 = rows[1] as HTMLElement
    row1.click()

    // 'this' should now be unchecked and moved into the unfinished group
    const items = parseBodyChecklist(task.description)
    expect(items.map((i) => i.text)).toEqual(['a', 'this', 'test'])
    expect(items.find((i) => i.text === 'this')?.done).toBe(false)
  })

  it('adds a new subtask above done items', () => {
    const host = activeDocument.body.createDiv()
    const task = makeTask({
      title: 'Parent Task',
      description: '- [ ] a\n- [x] this'
    })

    renderSubtasksPanel(host, task)

    const addInput = host.querySelector('.llk-subtask-add-input') as HTMLInputElement
    addInput.value = 'brand new'
    addInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    const items = parseBodyChecklist(task.description)
    expect(items.map((i) => i.text)).toEqual(['a', 'brand new', 'this'])
  })
})
