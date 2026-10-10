import { type ProjectListField, t, tn } from '@low-level-kanban/core'
import { AvatarStack, type AvatarPerson } from '#primitives/AvatarStack'
import { Chip } from '#primitives/Chip'
import { CollapseToggle } from '#primitives/CollapseToggle'
import { IconButton } from '#primitives/IconButton'
import { ProgressBar } from '#primitives/ProgressBar'
import { renderDueChip, type DueUrgency } from './dueChip'
import { renderGlyph } from './properties'
import { renderTreeGuides } from './treeGuides'

export interface ProjectRowProps {
  title: string
  icon: string
  color: string
  depth: number
  /** One entry per indent column: does an ancestor at that column still have rows below it. Null draws no connectors. */
  treeGuides: boolean[] | null
  isLastChild: boolean
  /** Sub-projects below this one. Above zero, the counts are the caller's subtree rollup. */
  childCount: number
  /** The cells after the title, in order. */
  fields: ProjectListField[]
  collapsed: boolean
  archived: boolean
  tasksDone: number
  tasksTotal: number
  overdue: number
  members: AvatarPerson[]
  /** Formatted by the caller; empty when nothing in the project has a date. */
  dueLabel: string
  dueUrgency: DueUrgency
  /** Leave it out while the list can't collapse, such as during a search: the row then has no toggle. */
  onToggleCollapsed?: () => void
  onClick: () => void
  onContextMenu: (e: MouseEvent) => void
  onActions: (e: MouseEvent) => void
}

const ROW_IGNORE_SELECTOR = 'button, .llk-chip--interactive, .llk-icon-btn, .llk-collapse-toggle'

export class ProjectRow {
  el: HTMLTableRowElement

  constructor(tbody: HTMLElement, props: ProjectRowProps) {
    this.el = tbody.createEl('tr', { cls: 'llk-table-row llk-project-row' })
    if (props.archived) this.el.addClass('llk-table-row--archived')
    this.el.style.setProperty('--depth', String(props.depth))

    const expand = this.el.createEl('td', { cls: 'llk-table-cell-expand' })
    const { onToggleCollapsed } = props
    if (props.childCount > 0 && onToggleCollapsed) {
      new CollapseToggle(expand, {
        collapsed: props.collapsed,
        onToggle: onToggleCollapsed,
        subject: t('collapse.subProjects')
      })
    }

    const title = this.el.createEl('td', { cls: 'llk-table-cell-title' })
    renderTreeGuides(title, props.treeGuides, props.isLastChild)
    const inner = title.createDiv('llk-table-title-inner')
    renderGlyph(inner.createSpan({ cls: 'llk-project-row-icon' }), { icon: props.icon, color: props.color })
    inner.createSpan({ text: props.title, cls: 'llk-task-title-text' })
    if (props.archived) new Chip(inner).setLabel(t('common.archived')).setVariant('outline').setSize('sm')

    for (const field of props.fields) renderCell(this.el.createEl('td', { cls: 'llk-table-cell' }), field, props)

    const actions = this.el.createEl('td', { cls: 'llk-table-cell llk-table-cell-actions' })
    new IconButton(actions)
      .setIcon('more-horizontal')
      .setTooltip(t('cell.projectActions'))
      .setRevealOnHover(true)
      .onClick((e) => props.onActions(e))

    this.el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest(ROW_IGNORE_SELECTOR)) return
      props.onClick()
    })
    this.el.addEventListener('contextmenu', (e) => props.onContextMenu(e))
  }
}

function renderCell(cell: HTMLElement, field: ProjectListField, props: ProjectRowProps): void {
  switch (field) {
    case 'progress':
      cell.addClass('llk-table-cell-progress')
      new ProgressBar(cell)
        .setSize('sm')
        .setValue(props.tasksTotal ? (props.tasksDone / props.tasksTotal) * 100 : 0)
        .setColor(props.color)
        .setShowLabel(true)
      return
    case 'tasks':
      cell.createSpan({ cls: 'llk-project-row-tasks', text: `${props.tasksDone}/${props.tasksTotal}` })
      if (props.overdue > 0) {
        new Chip(cell)
          .setLabel(tn('projectRow.overdue', props.overdue))
          .setVariant('solid')
          .setColor('var(--color-red)')
          .setSize('sm')
          .setStrong()
      }
      return
    case 'members':
      cell.addClass('llk-table-cell-assignees')
      new AvatarStack(cell).setPeople(props.members).setMax(3).setSize('sm')
      return
    case 'due':
      if (props.dueLabel) renderDueChip(cell, props.dueLabel, props.dueUrgency, 'sm')
      else cell.createSpan({ cls: 'llk-project-row-empty', text: '—' })
  }
}
