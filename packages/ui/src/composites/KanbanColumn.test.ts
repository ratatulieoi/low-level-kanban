// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { makeTask } from '@low-level-kanban/core'
import { KanbanColumn } from './KanbanColumn'

describe('KanbanColumn drag and drop', () => {
  const task1 = makeTask({ id: 't1', title: 'Task 1', status: 'todo' })
  const task2 = makeTask({ id: 't2', title: 'Task 2', status: 'todo' })

  it('renders cards and column elements correctly', () => {
    const host = document.body.createDiv()
    const col = new KanbanColumn(host, {
      column: { id: 'todo', label: 'To Do', color: '#ff0000' },
      fields: ['title'],
      cards: [
        {
          task: task1,
          people: [],
          overdue: false,
          showTagColors: false
        },
        {
          task: task2,
          people: [],
          overdue: false,
          showTagColors: false
        }
      ],
      onCardClick: vi.fn(),
      onCardContextMenu: vi.fn(),
      onCardDragStart: vi.fn(),
      onCardDragEnd: vi.fn(),
      onDrop: vi.fn().mockResolvedValue(undefined)
    })

    expect(col.el.dataset.column).toBe('todo')
    expect(col.el.querySelector('.llk-kanban-col-count')?.textContent).toBe('2')
    const cards = col.el.querySelectorAll('.llk-kanban-card')
    expect(cards).toHaveLength(2)
  })

  it('places a placeholder on dragover without moving the dragged card in the DOM', () => {
    const host = document.body.createDiv()
    const onDrop = vi.fn().mockResolvedValue(undefined)
    const col = new KanbanColumn(host, {
      column: { id: 'todo', label: 'To Do' },
      fields: ['title'],
      cards: [
        {
          task: task1,
          people: [],
          overdue: false,
          showTagColors: false
        },
        {
          task: task2,
          people: [],
          overdue: false,
          showTagColors: false
        }
      ],
      onCardClick: vi.fn(),
      onCardContextMenu: vi.fn(),
      onCardDragStart: vi.fn(),
      onCardDragEnd: vi.fn(),
      onDrop
    })

    const cardsEl = col.el.querySelector('.llk-kanban-cards') as HTMLElement
    const card1 = cardsEl.children[0] as HTMLElement
    const card2 = cardsEl.children[1] as HTMLElement

    // Mark card1 as dragging
    card1.classList.add('llk-kanban-card--dragging')

    // Simulate dragover
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    col.el.dispatchEvent(dragOverEvent)

    expect(col.el.classList.contains('llk-kanban-drop-target')).toBe(true)

    // The placeholder should be in cardsEl
    const placeholder = cardsEl.querySelector('.llk-kanban-drop-placeholder')
    expect(placeholder).not.toBeNull()

    // card1 and card2 must remain intact in their positions in the DOM
    expect(card1.parentElement).toBe(cardsEl)
    expect(card2.parentElement).toBe(cardsEl)
  })

  it('calls onDrop with taskId, columnId and afterTaskId, and cleans up placeholder', async () => {
    const host = document.body.createDiv()
    const onDrop = vi.fn().mockResolvedValue(undefined)
    const col = new KanbanColumn(host, {
      column: { id: 'todo', label: 'To Do' },
      fields: ['title'],
      cards: [
        {
          task: task1,
          people: [],
          overdue: false,
          showTagColors: false
        },
        {
          task: task2,
          people: [],
          overdue: false,
          showTagColors: false
        }
      ],
      onCardClick: vi.fn(),
      onCardContextMenu: vi.fn(),
      onCardDragStart: vi.fn(),
      onCardDragEnd: vi.fn(),
      onDrop
    })

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    col.el.dispatchEvent(dragOverEvent)

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? 't1' : '')
      }
    })
    col.el.dispatchEvent(dropEvent)

    expect(col.el.classList.contains('llk-kanban-drop-target')).toBe(false)
    expect(col.el.querySelector('.llk-kanban-drop-placeholder')).toBeNull()
    expect(onDrop).toHaveBeenCalledWith('t1', 'todo', null)
  })

  it('calls onDrop with afterTaskId when dropping before another card', async () => {
    const host = document.body.createDiv()
    const onDrop = vi.fn().mockResolvedValue(undefined)
    const col = new KanbanColumn(host, {
      column: { id: 'todo', label: 'To Do' },
      fields: ['title'],
      cards: [
        {
          task: task1,
          people: [],
          overdue: false,
          showTagColors: false
        },
        {
          task: task2,
          people: [],
          overdue: false,
          showTagColors: false
        }
      ],
      onCardClick: vi.fn(),
      onCardContextMenu: vi.fn(),
      onCardDragStart: vi.fn(),
      onCardDragEnd: vi.fn(),
      onDrop
    })

    const cardsEl = col.el.querySelector('.llk-kanban-cards') as HTMLElement
    const card2 = cardsEl.children[1] as HTMLElement

    // Mock bounding rects so y=10 is before card2 (top 50, height 50, mid 75)
    vi.spyOn(card2, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 100,
      left: 0,
      right: 100,
      width: 100,
      height: 50,
      x: 0,
      y: 50,
      toJSON: () => {}
    })

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(dragOverEvent, 'clientY', { value: 10 })
    col.el.dispatchEvent(dragOverEvent)

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? 't1' : '')
      }
    })
    col.el.dispatchEvent(dropEvent)

    expect(onDrop).toHaveBeenCalledWith('t1', 'todo', 't2')
  })
})
