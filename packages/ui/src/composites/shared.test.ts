// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_LIST_FIELDS } from '@low-level-kanban/core'
import * as ui from '../index'

afterEach(() => document.body.empty())

describe('shared controls after task-view removal', () => {
  it('keeps inline editing available to property inputs', async () => {
    const onChange = vi.fn<(value: string) => void>()
    ui.renderInputControl({
      container: document.body,
      value: '40',
      inputType: 'number',
      number: { min: 0, max: 100 },
      onChange
    })
    document.body.querySelector<HTMLButtonElement>('.llk-prop-inline')?.click()
    const input = document.body.querySelector<HTMLInputElement>('.llk-inline-edit')
    expect(input?.value).toBe('40')
    if (!input) throw new Error('no property input')
    input.value = '125'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith('100'))
  })

  it('keeps project rows, tree guides and their actions independent of task tables', () => {
    const onClick = vi.fn<() => void>()
    const onActions = vi.fn<(event: MouseEvent) => void>()
    const table = document.body.createEl('table')
    const row = new ui.ProjectRow(table.createEl('tbody'), {
      title: 'Launch',
      icon: 'folder-kanban',
      color: '#8b72be',
      depth: 1,
      treeGuides: [false],
      isLastChild: true,
      childCount: 1,
      fields: [...PROJECT_LIST_FIELDS],
      collapsed: false,
      archived: true,
      tasksDone: 2,
      tasksTotal: 4,
      overdue: 1,
      members: [{ name: 'Ada', color: '#c47070' }],
      dueLabel: 'Jan 20',
      dueUrgency: 'overdue',
      onToggleCollapsed: vi.fn(),
      onClick,
      onContextMenu: vi.fn(),
      onActions
    })
    expect(row.el.querySelector('.llk-tree-guide--elbow.llk-tree-guide--last')).not.toBeNull()
    expect(row.el.classList.contains('llk-table-row--archived')).toBe(true)
    expect(row.el.querySelector('.llk-project-row-tasks')?.textContent).toBe('2/4')
    expect(row.el.querySelector('.llk-avatar')).not.toBeNull()
    expect(row.el.querySelector('.llk-progress')).not.toBeNull()
    row.el.querySelector<HTMLElement>('.llk-task-title-text')?.click()
    expect(onClick).toHaveBeenCalledOnce()
    row.el.querySelector<HTMLButtonElement>('.llk-icon-btn')?.click()
    expect(onActions).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('exports the board model without retired task-view controls', () => {
    expect(ui.compareTasks).toBeTypeOf('function')
    expect(ui.boardTaskCount).toBeTypeOf('function')
    expect(ui.renderSnapshotKanban).toBeTypeOf('function')
    for (const name of [
      'renderSnapshotTable',
      'renderSnapshotGantt',
      'tableRows',
      'TaskRow',
      'ViewSwitcher',
      'Stepper',
      'renderMilestoneTimeline',
      'openNonWorkingDaysPopover'
    ]) {
      expect(ui).not.toHaveProperty(name)
    }
  })
})
