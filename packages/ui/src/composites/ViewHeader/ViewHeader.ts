import { createMenu, isPhone, type PlatformMenu } from '#platform'
import { showMenuBelow } from '#dom'
import { ChipButton } from '#primitives/ChipButton'
import { t } from '@low-level-kanban/core'
import { openTunePopover, type TuneItem } from './tunePopover'
import { openTuneSheet, type TuneSheetProps } from './tuneSheet'

/**
 * Classes the header adds one at a time while its row overflows: the query and option
 * labels and the count drop first, then the query and options fold into the Tune button,
 * then the breadcrumb folds its ancestors, then the primary action loses its label, then
 * the mode, saved view and scope labels, then the mode crumb itself. The title truncates
 * only after the last one. The Tune levels are skipped when the view gives Tune nothing to
 * list, since it is where the folded controls, the mode included, are reached.
 */
const COMPACT_LEVELS = [
  'llk-vh--icons',
  'llk-vh--tuned',
  'llk-vh--folded',
  'llk-vh--tight',
  'llk-vh--terse',
  'llk-vh--bare'
]
const TUNE_LEVELS = new Set(['llk-vh--tuned', 'llk-vh--bare'])

/** A phone lays the header out as two rows whatever its width, so nothing is measured there. */
const PHONE_LEVELS = ['llk-vh--phone', 'llk-vh--folded', 'llk-vh--bare']

/**
 * The one row every task view shows, as fixed slots the orchestrator fills: context
 * (breadcrumb and scope), view (saved view and count), query, view options and actions.
 * An empty slot takes no space. `bar` holds the optional second row for applied filters.
 *
 * When the row is too narrow, the query and options slots give way to `tune`, one button
 * whose popover lists the same controls with their state. The orchestrator describes them
 * through `setTuneItems` and keeps the button's badge current.
 *
 * On a phone the header is two rows: the title, search and a "More" menu (`setMoreMenu`),
 * then the saved view and Tune, which opens the sheet `setTuneSheet` describes. The
 * actions slot becomes a floating button over the view.
 */
export class ViewHeader {
  readonly el: HTMLElement
  readonly context: HTMLElement
  readonly view: HTMLElement
  readonly query: HTMLElement
  readonly options: HTMLElement
  readonly actions: HTMLElement
  readonly bar: HTMLElement
  readonly tune: ChipButton
  private readonly row: HTMLElement
  private readonly observer: ResizeObserver
  private tuneItems: (() => TuneItem[][]) | null = null
  private tuneSheet: (() => TuneSheetProps) | null = null
  private readonly phone = isPhone()

  constructor(parentEl: HTMLElement) {
    this.el = parentEl.createDiv('llk-vh')
    this.row = this.el.createDiv({ cls: 'llk-vh-row', attr: { role: 'toolbar' } })
    this.context = this.row.createDiv('llk-vh-slot llk-vh-context')
    this.view = this.row.createDiv('llk-vh-slot llk-vh-view')
    this.row.createDiv('llk-vh-spacer')
    this.query = this.row.createDiv('llk-vh-slot llk-vh-query')
    this.options = this.row.createDiv('llk-vh-slot llk-vh-options')
    const tuneSlot = this.row.createDiv('llk-vh-slot llk-vh-tune')
    this.tune = new ChipButton(tuneSlot)
      .setIcon('sliders-horizontal')
      .setLabel('')
      .setAriaLabel(t('header.viewOptions'))
      .setTooltip(t('header.viewOptions'))
      .onClick(() => {
        if (this.phone && this.tuneSheet) openTuneSheet(this.tune.el, this.tuneSheet())
        else if (this.tuneItems) openTunePopover(this.tune.el, this.tuneItems())
      })
    this.actions = this.row.createDiv('llk-vh-slot llk-vh-actions')
    this.bar = this.el.createDiv('llk-vh-bar')
    this.observer = new ResizeObserver(() => this.fit())
    this.observer.observe(this.row)
    if (this.phone) this.el.addClasses(PHONE_LEVELS)
  }

  /** The controls the Tune button lists, asked again each time it opens so their state is current. */
  setTuneItems(items: () => TuneItem[][]): this {
    this.tuneItems = items
    return this
  }

  /** What Tune opens on a phone, asked again each time it opens. */
  setTuneSheet(sheet: () => TuneSheetProps): this {
    this.tuneSheet = sheet
    return this
  }

  /** Adds the phone's "More" button, whose menu `build` fills each time it opens. Ignored elsewhere. */
  setMoreMenu(build: (menu: PlatformMenu, anchor: HTMLElement) => void): this {
    if (!this.phone) return this
    const more = new ChipButton(this.row.createDiv('llk-vh-slot llk-vh-more'))
      .setIcon('ellipsis-vertical')
      .setLabel('')
      .setAriaLabel(t('header.more'))
    more.onClick(() => {
      const menu = createMenu()
      build(menu, more.el)
      showMenuBelow(menu, more.el, 'right')
    })
    return this
  }

  /** Picks the richest level that fits. Call after changing what a slot holds. */
  fit(): void {
    if (this.phone) return
    this.el.removeClasses(COMPACT_LEVELS)
    this.el.addClass('llk-vh--measuring')
    for (const level of COMPACT_LEVELS) {
      if (this.row.scrollWidth <= this.row.clientWidth) break
      if (TUNE_LEVELS.has(level) && !this.tuneItems) continue
      this.el.addClass(level)
    }
    this.el.removeClass('llk-vh--measuring')
  }

  destroy(): void {
    this.observer.disconnect()
    this.el.remove()
  }
}
