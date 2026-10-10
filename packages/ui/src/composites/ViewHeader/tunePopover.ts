import { Popover } from '#primitives/Popover'
import { renderGlyph, renderOptionRow } from '../properties/optionList'

export interface TuneItem {
  icon: string
  label: string
  /** The control's current value, shown faint after the label ("5", "Priority +1"). */
  state?: string
  /** Opens the control's own popover or menu, anchored to the Tune button. */
  onOpen?: (anchor: HTMLElement) => void
  /** Draws the control inside the row instead, for one that works in place (a stepper). */
  control?: (parent: HTMLElement) => void
}

/**
 * The header's query and view options as one list, each row showing its state. Picking a
 * row closes the list and opens that control anchored to the same button; a row with its
 * own control stays open. Sections are separated by a rule.
 */
export function renderTunePanel(
  parent: HTMLElement,
  sections: TuneItem[][],
  close: () => void,
  anchor: HTMLElement
): void {
  const body = parent.createDiv('llk-tune-pop')
  for (const [index, items] of sections.filter((section) => section.length).entries()) {
    const list = body.createDiv('llk-pop-list')
    list.toggleClass('llk-pop-section', index > 0)
    for (const item of items) {
      const { control, onOpen } = item
      if (control) {
        const row = list.createDiv('llk-tune-row')
        renderGlyph(row, { icon: item.icon })
        row.createSpan({ cls: 'llk-pop-item-label', text: item.label })
        control(row)
        continue
      }
      renderOptionRow(list, {
        icon: item.icon,
        label: item.label,
        note: item.state,
        onPick: () => {
          close()
          onOpen?.(anchor)
        }
      })
    }
  }
}

/** The Tune list in a popover under `anchor`, which each row's own control then opens at. */
export const openTunePopover = (anchor: HTMLElement, sections: TuneItem[][]): Popover =>
  Popover.show({ anchor, align: 'right', width: 240 }, (el, close) => renderTunePanel(el, sections, close, anchor))
