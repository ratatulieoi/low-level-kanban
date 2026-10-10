import { setIcon } from '#platform'
import type { Task } from '@low-level-kanban/core'
import { formatBadgeText, isIconName } from '#icons'
import { safeAsync } from '#dom'
import { KanbanCard, type CardFieldValue } from './KanbanCard'
import type { AvatarPerson } from '#primitives/AvatarStack'

/** What a column stands for: a status, a priority, a person, a tag... */
export interface KanbanColumnHead {
  id: string
  label: string
  color?: string
  icon?: string
}

export interface KanbanCardData {
  people: AvatarPerson[]
  task: Task
  priorityColor?: string
  descriptionPreview?: string
  tagColors?: Record<string, string>
  customValues?: Record<string, CardFieldValue>
  renderSource?: (parent: HTMLElement) => void
  overdue: boolean
  showTagColors: boolean
}

export interface KanbanColumnProps {
  column: KanbanColumnHead
  /** What every card shows, in order. */
  fields: string[]
  cards: KanbanCardData[]
  onCardClick: (task: Task) => void
  onCardContextMenu: (task: Task, e: MouseEvent) => void
  onCardDragStart: (task: Task) => void
  onCardDragEnd: () => void
  onDrop: (taskId: string, columnId: string, afterTaskId?: string | null) => Promise<void>
}

export class KanbanColumn {
  el: HTMLElement

  constructor(parentEl: HTMLElement, props: KanbanColumnProps) {
    const col = parentEl.createDiv('llk-kanban-col')
    const { column } = props
    const color = column.color ?? 'var(--text-muted)'
    col.dataset.column = column.id
    this.el = col

    const header = col.createDiv('llk-kanban-col-header')
    header.style.setProperty('--col-color', color)

    const topBar = header.createDiv('llk-kanban-col-topbar')
    topBar.setCssStyles({ background: color })

    const titleRow = header.createDiv('llk-kanban-col-title-row')
    const badge = titleRow.createSpan({ cls: 'llk-kanban-col-badge' })
    if (column.icon && isIconName(column.icon)) {
      setIcon(badge.createSpan({ cls: 'llk-kanban-col-badge-icon' }), column.icon)
      badge.appendText(column.label)
    } else {
      badge.setText(formatBadgeText(column.icon ?? '', column.label))
    }
    badge.style.color = color

    const headerRight = titleRow.createDiv('llk-kanban-col-header-right')
    headerRight.createSpan({
      text: String(props.cards.length),
      cls: 'llk-kanban-col-count'
    })

    const cardsEl = col.createDiv('llk-kanban-cards')
    cardsEl.dataset.column = column.id

    for (const card of props.cards) {
      new KanbanCard(cardsEl, {
        fields: props.fields,
        task: card.task,
        people: card.people,
        priorityColor: card.priorityColor,
        descriptionPreview: card.descriptionPreview,
        tagColors: card.tagColors,
        customValues: card.customValues,
        renderSource: card.renderSource,
        overdue: card.overdue,
        showTagColors: card.showTagColors,
        onClick: () => props.onCardClick(card.task),
        onContextMenu: (e) => props.onCardContextMenu(card.task, e),
        onDragStart: () => props.onCardDragStart(card.task),
        onDragEnd: () => props.onCardDragEnd()
      })
    }

    col.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      col.addClass('llk-kanban-drop-target')

      const dragging = col.ownerDocument.querySelector<HTMLElement>('.llk-kanban-card--dragging')
      const cardHeight = dragging?.offsetHeight || 60
      const placeholder = getOrCreatePlaceholder(col.ownerDocument, cardHeight)

      const isOverHeader = header.contains(e.target as Node)
      const afterEl = isOverHeader ? getFirstStationaryCard(cardsEl) : getDragAfterElement(cardsEl, e.clientY)

      if (afterEl) {
        if (placeholder.nextElementSibling !== afterEl) {
          cardsEl.insertBefore(placeholder, afterEl)
        }
      } else {
        if (placeholder.parentElement !== cardsEl || placeholder.nextElementSibling !== null) {
          cardsEl.appendChild(placeholder)
        }
      }
    })

    col.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && col.contains(e.relatedTarget as Node)) return
      col.removeClass('llk-kanban-drop-target')
      const placeholder = cardsEl.querySelector('.llk-kanban-drop-placeholder')
      placeholder?.remove()
    })

    col.addEventListener(
      'drop',
      safeAsync(async (e: DragEvent) => {
        e.preventDefault()
        col.removeClass('llk-kanban-drop-target')
        const taskId = e.dataTransfer?.getData('text/plain') ?? ''
        if (!taskId) return

        const placeholder = cardsEl.querySelector<HTMLElement>('.llk-kanban-drop-placeholder')
        let afterTaskId: string | null = null
        if (placeholder) {
          let nextCard = placeholder.nextElementSibling as HTMLElement | null
          while (
            nextCard &&
            (!nextCard.classList.contains('llk-kanban-card') ||
              nextCard.classList.contains('llk-kanban-card--dragging'))
          ) {
            nextCard = nextCard.nextElementSibling as HTMLElement | null
          }
          afterTaskId = nextCard?.dataset.taskId ?? null
          placeholder.remove()
        }

        await props.onDrop(taskId, column.id, afterTaskId)
      })
    )
  }
}

function getOrCreatePlaceholder(doc: Document, height?: number): HTMLElement {
  let placeholder = doc.querySelector<HTMLElement>('.llk-kanban-drop-placeholder')
  if (!placeholder) {
    placeholder = createDiv('llk-kanban-drop-placeholder')
  }
  if (height && height > 0) {
    placeholder.style.height = `${height}px`
  }
  return placeholder
}

function getFirstStationaryCard(container: HTMLElement): Element | null {
  return container.querySelector('.llk-kanban-card:not(.llk-kanban-card--dragging)')
}

function getDragAfterElement(container: HTMLElement, y: number): Element | null {
  const cards = Array.from(container.querySelectorAll('.llk-kanban-card:not(.llk-kanban-card--dragging)'))
  let closest: Element | null = null
  let closestOffset = Number.NEGATIVE_INFINITY
  for (const card of cards) {
    const box = card.getBoundingClientRect()
    const offset = y - box.top - box.height / 2
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset
      closest = card
    }
  }
  return closest
}
