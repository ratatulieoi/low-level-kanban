import {
  type Task,
  checklistProgress,
  daysLeft,
  formatDate,
  formatDateShort,
  parseBodyChecklist,
  stringToColor,
  t
} from '@low-level-kanban/core'
import { setTooltip } from '#platform'
import { AvatarStack, type AvatarPerson } from '#primitives/AvatarStack'
import { Chip } from '#primitives/Chip'
import { ProgressBar } from '#primitives/ProgressBar'
import { renderDueChip } from './dueChip'
import { renderTagChip } from './tagChip'

/** A custom field's value as a card shows it. */
export interface CardFieldValue {
  name: string
  text: string
}

export interface KanbanCardProps {
  /** The card fields to show, in order (`priority`, `tags`, `cf:<id>`...). */
  fields: string[]
  people: AvatarPerson[]
  task: Task
  priorityColor?: string
  descriptionPreview?: string
  /** A tag's explicit color, keyed by tag; missing tags fall back to their automatic color. */
  tagColors?: Record<string, string>
  /** Keyed by field id, `cf:<id>`. A field without a value here shows nothing. */
  customValues?: Record<string, CardFieldValue>
  /** Leading slot in the footer, filled when a card has to say where it is from. */
  renderSource?: (parent: HTMLElement) => void
  overdue: boolean
  showTagColors: boolean
  onClick: () => void
  onContextMenu: (e: MouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
}

export class KanbanCard {
  el: HTMLElement

  constructor(parentEl: HTMLElement, props: KanbanCardProps) {
    const { task } = props
    const card = parentEl.createDiv('llk-kanban-card')
    card.draggable = true
    card.dataset.taskId = task.id
    this.el = card

    const { fields } = props
    if (props.priorityColor && fields.includes('priority')) {
      const priorityBar = card.createDiv('llk-kanban-card-priority-bar')
      priorityBar.setCssStyles({ background: props.priorityColor })
    }

    const body = card.createDiv('llk-kanban-card-body')

    const titleRow = body.createDiv('llk-kanban-card-title-row')
    const titleEl = titleRow.createSpan({ text: task.title, cls: 'llk-kanban-card-title' })
    if (task.createdAt) {
      const createdStr = formatDate(task.createdAt)
      if (createdStr) {
        setTooltip(titleEl, `${t('columns.created')}: ${createdStr}`)
      }
    }
    if (task.type === 'milestone') {
      new Chip(titleRow)
        .setLabel(t('chip.milestone'))
        .setVariant('solid')
        .setSize('sm')
        .setColor('var(--color-purple)')
        .setTooltip(t('taskForm.typeMilestone'))
    }
    if (task.type === 'subtask') {
      new Chip(titleRow)
        .setLabel(t('chip.subtask'))
        .setVariant('solid')
        .setSize('sm')
        .setColor('var(--color-green)')
        .setTooltip(t('taskForm.typeSubtask'))
    }
    if (task.recurrence) {
      new Chip(titleRow)
        .setLabel(t('chip.recurring'))
        .setVariant('solid')
        .setSize('sm')
        .setColor('var(--color-blue)')
        .setTooltip(t('chip.recurringTooltip'))
    }

    for (const field of fields) {
      if (field === 'description' && props.descriptionPreview) {
        body.createDiv({ cls: 'llk-kanban-card-description', text: props.descriptionPreview })
      } else if (field === 'tags' && task.tags.length) {
        const tagsEl = body.createDiv('llk-kanban-card-tags')
        for (const tag of task.tags.slice(0, 3)) {
          renderTagChip(tagsEl, tag, props.showTagColors, props.tagColors?.[tag] ?? stringToColor(tag))
        }
      } else if (field === 'progress') {
        const items = parseBodyChecklist(task.description)
        const progress = items.length ? checklistProgress(task.description) : task.progress
        if (items.length > 0 || progress > 0) {
          const wrap = body.createDiv('llk-kanban-card-progress')
          new ProgressBar(wrap).setSize('sm').setValue(progress)
          if (items.length) {
            const done = items.filter((item) => item.done).length
            wrap.createSpan({ cls: 'llk-kanban-card-progress-label', text: `${done}/${items.length}` })
          }
        }
      } else if (props.customValues?.[field]?.text) {
        const { name, text } = props.customValues[field]
        const row = body.createDiv('llk-kanban-card-field')
        row.createSpan({ cls: 'llk-kanban-card-field-name', text: name })
        row.createSpan({ cls: 'llk-kanban-card-field-value', text })
      }
    }

    const hasProject = fields.includes('project') && Boolean(props.renderSource)
    const hasAssignees = fields.includes('assignees') && props.people.length > 0
    const hasDue = fields.includes('due') && Boolean(task.due)

    if (hasProject || hasAssignees || hasDue) {
      const footer = body.createDiv('llk-kanban-card-footer')
      if (hasProject) {
        const wrap = footer.createDiv('llk-kanban-card-project')
        props.renderSource?.(wrap)
        if (!wrap.childElementCount && !wrap.textContent?.trim()) wrap.remove()
      }
      if (hasAssignees) {
        const wrap = footer.createDiv('llk-kanban-card-assignees')
        new AvatarStack(wrap).setPeople(props.people).setMax(3).setSize('sm')
      }
      if (hasDue) {
        const wrap = footer.createDiv('llk-kanban-card-due')
        renderDueChip(wrap, formatDateShort(task.due), props.overdue ? 'overdue' : 'normal', 'sm')
          .setLeadingIcon('calendar')
          .setTooltip(daysLeft(task.due) || t('columns.due'))
      }
      if (footer.childElementCount === 0) footer.remove()
    }

    card.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        target !== card &&
        (target.closest('button, input, select, textarea, .llk-chip-rm, .llk-icon-btn') || target.isContentEditable)
      ) {
        e.preventDefault()
        return
      }
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }
      card.addClass('llk-kanban-card--dragging')
      window.setTimeout(() => card.addClass('llk-dragging'), 0)
      props.onDragStart()
    })

    card.addEventListener('dragend', (e) => {
      e.stopPropagation()
      card.removeClass('llk-kanban-card--dragging')
      card.removeClass('llk-dragging')
      props.onDragEnd()
    })

    card.addEventListener('click', () => props.onClick())
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      props.onContextMenu(e)
    })
  }
}
