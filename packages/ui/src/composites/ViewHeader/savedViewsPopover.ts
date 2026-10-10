import { createButton, setTooltip } from '#platform'
import { makeReorderable, safeAsync } from '#dom'
import { Checkbox } from '#primitives/Checkbox'
import { IconButton } from '#primitives/IconButton'
import { Popover } from '#primitives/Popover'
import { locale, t } from '@low-level-kanban/core'
import { renderPopSearch } from '../popoverParts'
import { renderOptionRow } from '../properties/optionList'

export interface SavedViewItem {
  id: string
  name: string
  /** The icon of the mode the view opens in, when it names one. */
  modeIcon?: string
  isDefault?: boolean
}

export interface SavedViewsProps {
  views: SavedViewItem[]
  activeId: string | null
  /** What differs from the active view, named for the reader. Empty when nothing does. */
  changes: string[]
  /** False while nothing differs from the defaults, so there is nothing to save. */
  canSave: boolean
  /** Where a new view is kept, so the reader knows whether it syncs. */
  storageNote: string
  /** The built-in view at the top of the list, which shows everything: "All tasks", "All projects". */
  builtInName: string
  onSelect: (id: string | null) => void
  onSave: (name: string, isDefault: boolean) => Promise<void>
  onUpdate: (id: string) => Promise<void>
  onRevert: () => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReorder: (ids: string[]) => Promise<void>
  /** Stars a view as the one the scope opens with, or clears the star with null. */
  onSetDefault: (id: string | null) => Promise<void>
}

/** Views past this count get a search field above the list. */
const SEARCH_FROM = 8

/**
 * The saved views of the current scope. Unsaved changes to the active view come first,
 * with Update, Save as new and Revert; then the list, where a view is picked, starred as
 * the default, renamed, deleted or dragged into another place; then a form to save the
 * current state as a new view.
 */
export function renderSavedViewsPanel(parent: HTMLElement, props: SavedViewsProps, close: () => void): void {
  const body = parent.createDiv('llk-saved-views')
  const run = (action: () => Promise<void>): void => {
    close()
    safeAsync(action)()
  }

  const foot = createDiv('llk-saved-views-foot llk-pop-section')
  const openForm = (): void => {
    foot.empty()
    foot.createDiv({ cls: 'llk-pop-heading', text: t('header.saveAsNewTitle') })
    const input = foot.createEl('input', {
      cls: 'llk-pop-field',
      attr: { placeholder: t('header.viewName'), spellcheck: 'false' }
    })
    const defaultRow = foot.createEl('label', { cls: 'llk-saved-views-check' })
    const isDefault = new Checkbox(defaultRow).el
    defaultRow.createSpan({ text: t('header.makeDefault') })
    foot.createDiv({ cls: 'llk-saved-views-storage', text: props.storageNote })
    input.focus()
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const name = input.value.trim()
      if (name) run(() => props.onSave(name, isDefault.checked))
    })
  }

  const active = props.views.find((view) => view.id === props.activeId)
  if (active && props.changes.length) {
    const dirty = body.createDiv('llk-saved-views-dirty')
    const note = dirty.createDiv('llk-saved-views-dirty-note')
    note.createSpan('llk-dirty-dot')
    const changes = new Intl.ListFormat(locale(), { type: 'conjunction', style: 'narrow' }).format(props.changes)
    note.createSpan({ text: t('header.unsaved', { changes }) })
    const actions = dirty.createDiv('llk-saved-views-dirty-actions')
    createButton(actions)
      .setButtonText(t('header.updateView'))
      .setCta()
      .onClick(() => run(() => props.onUpdate(active.id)))
    createButton(actions).setButtonText(t('header.saveAsNew')).onClick(openForm)
    new IconButton(actions)
      .setIcon('undo-2')
      .setTooltip(t('header.revert'))
      .onClick(() => {
        close()
        props.onRevert()
      })
  }

  const search =
    props.views.length >= SEARCH_FROM ? renderPopSearch(body, t('header.findView'), () => renderList()) : null
  const list = body.createDiv('llk-pop-list')

  const beginRename = (main: HTMLButtonElement, view: SavedViewItem): void => {
    const input = createEl('input', { cls: 'llk-pop-field llk-saved-view-rename', value: view.name })
    main.replaceWith(input)
    input.focus()
    input.select()
    let done = false
    const commit = (): void => {
      if (done) return
      done = true
      const name = input.value.trim()
      if (!name || name === view.name) {
        input.replaceWith(main)
        return
      }
      main.find('.llk-pop-item-label')?.setText(name)
      run(() => props.onRename(view.id, name))
    }
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      commit()
    })
    input.addEventListener('blur', commit)
  }

  const renderRow = (
    parent: HTMLElement,
    name: string,
    selected: boolean,
    icon: string | undefined,
    onSelect: () => void
  ): { row: HTMLElement; main: HTMLButtonElement } => {
    const row = parent.createDiv('llk-saved-view-row')
    const main = renderOptionRow(row, {
      label: name,
      trailingIcon: icon,
      check: 'start',
      selected,
      onPick: () => {
        close()
        onSelect()
      }
    })
    main.addClass('llk-saved-view-main')
    return { row, main }
  }

  const renderList = (): void => {
    list.empty()
    const query = search?.value.trim().toLowerCase() ?? ''
    if (!query) {
      const all = renderRow(list, props.builtInName, props.activeId === null, undefined, () => props.onSelect(null))
      all.row.createSpan({ cls: 'llk-saved-view-note', text: t('header.builtIn') })
    }
    const rows: { el: HTMLElement; id: string }[] = []
    for (const view of props.views.filter((v) => !query || v.name.toLowerCase().includes(query))) {
      const { row, main } = renderRow(list, view.name, props.activeId === view.id, view.modeIcon, () =>
        props.onSelect(view.id)
      )

      const star = rowAction(row, 'star', view.isDefault ? t('header.isDefault') : t('header.makeDefault'), () =>
        run(() => props.onSetDefault(view.isDefault ? null : view.id))
      )
      star.toggleClass('is-default', !!view.isDefault)
      star.toggleClass('llk-icon-btn--hover-only', !view.isDefault)
      rowAction(row, 'pencil', t('header.rename'), () => beginRename(main, view))
      rowAction(row, 'trash-2', t('header.deleteView'), () => run(() => props.onDelete(view.id)))

      rows.push({ el: row, id: view.id })
    }
    if (!query) makeReorderable(rows, (ids) => run(() => props.onReorder(ids)))
    if (!props.views.length) list.createDiv({ cls: 'llk-pop-empty', text: t('header.noViewsHint') })
  }

  renderList()

  body.appendChild(foot)
  const start = renderOptionRow(foot, { label: t('header.saveCurrent'), icon: 'plus', accent: true, onPick: openForm })
  start.disabled = !props.canSave
  if (!props.canSave) setTooltip(start, t('header.nothingToSave'))
}

/** The saved views in a popover under `anchor`, with the search field focused when there is one. */
export function openSavedViewsPopover(anchor: HTMLElement, props: SavedViewsProps): Popover {
  const pop = Popover.show({ anchor, width: 300 }, (el, close) => renderSavedViewsPanel(el, props, close))
  pop.contentEl.find('input.llk-pop-field')?.focus()
  return pop
}

function rowAction(row: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
  const button = new IconButton(row).setIcon(icon).setTooltip(label).setRevealOnHover(true).onClick(onClick).el
  button.addClass('llk-saved-view-action')
  return button
}
