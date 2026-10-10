// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_STATUSES, makeTask } from '@low-level-kanban/core'
import { KanbanCard } from './KanbanCard'
import { renderStatusBadge } from '../StatusBadge'

function noop(): void {}

describe('KanbanCard outside Obsidian', () => {
  it('renders the task with the plain DOM platform', () => {
    const host = document.body.createDiv()
    const onClick = vi.fn<() => void>()
    const card = new KanbanCard(host, {
      fields: ['priority', 'tags', 'due', 'cf:sprint'],
      people: [],
      task: makeTask({ id: 't1', title: 'Write the spec', due: '2030-01-01', tags: ['docs'] }),
      priorityColor: 'red',
      customValues: { 'cf:sprint': { name: 'Sprint', text: 'S1' } },
      overdue: false,
      showTagColors: false,
      onClick,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })
    expect(card.el.dataset.taskId).toBe('t1')
    expect(card.el.find('.llk-kanban-card-title')?.textContent).toBe('Write the spec')
    expect(card.el.find('.llk-kanban-card-priority-bar')).not.toBeNull()
    expect(card.el.find('.llk-kanban-card-field')?.textContent).toBe('SprintS1')
    card.el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('leaves out the fields it is not given', () => {
    const host = document.body.createDiv()
    const card = new KanbanCard(host, {
      fields: [],
      people: [],
      task: makeTask({ title: 'Bare', due: '2030-01-01', tags: ['docs'], progress: 50 }),
      priorityColor: 'red',
      overdue: false,
      showTagColors: false,
      onClick: noop,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })
    expect(card.el.find('.llk-kanban-card-priority-bar')).toBeNull()
    expect(card.el.find('.llk-kanban-card-tags')).toBeNull()
    expect(card.el.find('.llk-kanban-card-footer')).toBeNull()
  })

  it('shows created date when hovering the card title and does not show created date as a field', () => {
    const host = document.body.createDiv()
    const card = new KanbanCard(host, {
      fields: ['tags'],
      people: [],
      task: makeTask({ title: 'Task with created date', tags: ['work'], createdAt: '2026-10-05T09:00:00.000Z' }),
      overdue: false,
      showTagColors: false,
      onClick: noop,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })
    const body = card.el.find('.llk-kanban-card-body')
    expect(body).not.toBeNull()
    expect(card.el.find('.llk-kanban-card-created')).toBeNull()

    const titleEl = card.el.find('.llk-kanban-card-title')
    expect(titleEl).not.toBeNull()
    expect(titleEl?.textContent).toBe('Task with created date')
    expect(titleEl?.getAttribute('aria-label')).toBe('Created: Oct 5, 2026')
    expect(card.el.find('.llk-kanban-card-footer')).toBeNull()
  })

  it('always renders active due date on bottom right in the footer with bright yellow color', () => {
    const host = document.body.createDiv()
    const card = new KanbanCard(host, {
      // Even if 'due' is ordered first, it renders in the footer at the bottom
      fields: ['due', 'tags'],
      people: [],
      task: makeTask({ title: 'Important deadline', tags: ['work'], due: '2026-11-20' }),
      overdue: false,
      showTagColors: false,
      onClick: noop,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })

    const body = card.el.find('.llk-kanban-card-body')
    expect(body).not.toBeNull()
    const footer = body?.find('.llk-kanban-card-footer')
    expect(footer).not.toBeNull()

    const dueEl = footer?.find('.llk-kanban-card-due')
    expect(dueEl).not.toBeNull()
    expect(dueEl?.textContent).toBe('Nov 20')

    const chip = dueEl?.find('.llk-chip')
    expect(chip).not.toBeNull()
    expect(chip?.hasClass('llk-chip--solid')).toBe(false)
    expect(chip?.style.getPropertyValue('--llk-chip-color')).toBe('var(--color-yellow, #facc15)')
    expect(chip?.getAttribute('aria-label')).toMatch(/left|today|overdue/)
  })

  it('renders overdue due date with red styling in footer and overdue tooltip', () => {
    const host = document.body.createDiv()
    const card = new KanbanCard(host, {
      fields: ['tags', 'due'],
      people: [],
      task: makeTask({ title: 'Late task', tags: ['work'], due: '2026-09-01' }),
      overdue: true,
      showTagColors: false,
      onClick: noop,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })

    const chip = card.el.find('.llk-kanban-card-footer .llk-kanban-card-due .llk-chip')
    expect(chip).not.toBeNull()
    expect(chip?.hasClass('llk-chip--solid')).toBe(true)
    expect(chip?.hasClass('llk-chip--strong')).toBe(true)
    expect(chip?.style.getPropertyValue('--llk-chip-color')).toBe('var(--color-red)')
    expect(chip?.getAttribute('aria-label')).toMatch(/overdue/)
  })
})

describe('status badge outside Obsidian', () => {
  it('opens a menu of statuses and reports the pick', () => {
    const host = document.body.createDiv()
    const onChange = vi.fn<(status: string) => void>()
    const task = makeTask({ title: 'Pick me', status: DEFAULT_STATUSES[0].id })
    const badge = renderStatusBadge(host, task, DEFAULT_STATUSES, onChange)
    expect(badge.textContent).toContain(DEFAULT_STATUSES[0].label)

    badge.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 20 }))
    const items = document.body.findAll('.menu .menu-item')
    expect(items.map((item) => item.find('.menu-item-title')?.textContent)).toEqual(
      DEFAULT_STATUSES.map((status) => status.label)
    )
    expect(items[0].hasClass('mod-checked')).toBe(true)

    items[1].click()
    expect(onChange).toHaveBeenCalledWith(DEFAULT_STATUSES[1].id)
    expect(document.body.find('.menu')).toBeNull()
  })
})
