import { ChipButton } from '#primitives/ChipButton'
import { Popover } from '#primitives/Popover'
import {
  type FieldCatalog,
  type FieldList,
  type ViewFields,
  availableFields,
  hiddenFields,
  shownFields,
  t,
  tidyFields,
  viewFieldLabel,
  withFieldShown
} from '@dotpm/core'
import { renderPopHead } from '../popoverParts'
import { renderVisibilityList } from '../visibilityList'

export interface FieldsPopoverProps {
  /** Edited in place. */
  fields: ViewFields
  catalog: FieldCatalog
  onChange: () => void
}

/** The fields a board card shows, in their saved order. */
export function renderFieldsPanel(parent: HTMLElement, props: FieldsPopoverProps): void {
  const root = parent.createDiv('pm-fields-pop')
  const { fields, catalog } = props
  const body = root.createDiv('pm-fields-body')
  const mode = 'kanban'

  const list = (): FieldList => (fields.kanban ??= { visible: shownFields(fields, mode, catalog) })

  const changed = (): void => {
    tidyFields(fields, catalog)
    render()
    props.onChange()
  }

  const label = (id: string): string => viewFieldLabel(id, catalog.customFields)
  const toggle = (id: string): void => {
    const shown = shownFields(fields, mode, catalog)
    list().visible = shown.includes(id)
      ? shown.filter((field) => field !== id)
      : withFieldShown(shown, id, availableFields(mode, catalog))
    changed()
  }

  const render = (): void => {
    body.empty()
    const shown = shownFields(fields, mode, catalog)
    const hidden = hiddenFields(fields, mode, catalog)
    renderVisibilityList(body, {
      rows: shown.map((id) => ({
        id,
        label: label(id),
        hidden: false
      })),
      showLabel: t('header.showField'),
      hideLabel: t('header.hideField'),
      onToggle: toggle,
      onReorder: (ids) => {
        list().visible = ids
        changed()
      }
    })

    if (hidden.length) {
      renderPopHead(body, { title: t('header.hiddenFields'), section: true })
      renderVisibilityList(body, {
        rows: hidden.map((id) => ({ id, label: label(id), hidden: true })),
        showLabel: t('header.showField'),
        hideLabel: t('header.hideField'),
        onToggle: toggle
      })
    }

    const foot = body.createDiv('pm-fields-foot pm-pop-section')
    new ChipButton(foot)
      .setVariant('flat')
      .setLabel(t('header.hideAll'))
      .setDisabled(shown.length === 0)
      .onClick(() => {
        list().visible = []
        changed()
      })
  }

  render()
}

/** The fields panel in a popover under `anchor`. */
export const openFieldsPopover = (anchor: HTMLElement, props: FieldsPopoverProps): Popover =>
  Popover.show({ anchor, width: 320 }, (el) => renderFieldsPanel(el, props))
