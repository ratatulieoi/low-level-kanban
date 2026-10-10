import { setIcon, setTooltip } from '#platform'
import { makeReorderable } from '#dom'
import { IconButton } from '#primitives/IconButton'

export interface VisibilityRow {
  id: string
  label: string
  hidden: boolean
  /** Faint text after the label, such as a task count. */
  detail?: string
  /** Draws the row's leading glyph, when it has one. */
  glyph?: (el: HTMLElement) => void
  /** Shown first, without a grip or an eye. */
  locked?: boolean
  /** Styles the detail as a placeholder, such as "empty" for a column with no tasks. */
  quiet?: boolean
}

export interface VisibilityListProps {
  rows: VisibilityRow[]
  showLabel: string
  hideLabel: string
  lockedLabel?: string
  onToggle: (id: string) => void
  /** The ids of the unlocked rows in their new order. Rows can't be dragged without it. */
  onReorder?: (ids: string[]) => void
}

/** Rows of grip, glyph, label, detail and eye: the list the Group and Fields popovers share. */
export function renderVisibilityList(parent: HTMLElement, props: VisibilityListProps): HTMLElement {
  const list = parent.createDiv('llk-vis-list')
  const movable: { el: HTMLElement; id: string }[] = []

  for (const item of props.rows) {
    const draggable = !item.locked && !!props.onReorder
    const row = list.createDiv('llk-vis-row')
    row.dataset.id = item.id
    row.toggleClass('is-hidden', item.hidden)
    row.toggleClass('is-quiet', !!item.quiet)
    const grip = row.createSpan('llk-vis-grip')
    if (draggable) setIcon(grip, 'grip-vertical')
    if (item.glyph) item.glyph(row.createSpan('llk-vis-glyph'))
    row.createSpan({ cls: 'llk-vis-label', text: item.label })
    if (item.detail !== undefined) row.createSpan({ cls: 'llk-vis-detail', text: item.detail })

    if (item.locked) {
      const lock = row.createSpan('llk-vis-lock')
      setIcon(lock, 'lock')
      if (props.lockedLabel) setTooltip(lock, props.lockedLabel)
    } else {
      const label = item.hidden ? props.showLabel : props.hideLabel
      new IconButton(row)
        .setIcon(item.hidden ? 'eye-off' : 'eye')
        .setTooltip(label)
        .onClick(() => props.onToggle(item.id))
        .el.addClass('llk-vis-eye')
    }
    if (draggable) movable.push({ el: row, id: item.id })
  }
  const { onReorder } = props
  if (onReorder) makeReorderable(movable, onReorder)
  return list
}
