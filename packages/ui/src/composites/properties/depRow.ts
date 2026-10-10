import { t } from '@low-level-kanban/core'
import { setIcon, setTooltip } from '#platform'
import { IconButton } from '#primitives/IconButton'
import { renderNoteLink } from '../noteLink'

/** The note a row's task lives in, and what activating the row leads to. */
export interface DepLink {
  path: string
  open: () => void
}

export interface DepRowProps {
  id: string
  title: string
  link?: DepLink | null
  tooltip?: string
  onRemove?: () => void
}

/**
 * One task in a dependency list: link icon, task id, title, and a remove button when the
 * list is editable. Backs both Depends on and Blocks, so the two read the same.
 */
export function renderDepRow(parent: HTMLElement, props: DepRowProps): HTMLElement {
  const row = parent.createDiv('llk-dep-row')
  setIcon(row.createSpan({ cls: 'llk-dep-icon' }), 'link-2')
  row.createSpan({ cls: 'llk-dep-id', text: props.id })
  const link = props.link
  if (!link) {
    row.createSpan({ cls: 'llk-dep-title', text: props.title })
  } else {
    renderNoteLink(row, { label: props.title, path: link.path, open: link.open, cls: 'llk-dep-title' })
  }
  if (props.tooltip) setTooltip(row, props.tooltip)
  if (props.onRemove) {
    new IconButton(row).setIcon('x').setTooltip(t('taskForm.removeDependency')).onClick(props.onRemove)
  }
  return row
}
