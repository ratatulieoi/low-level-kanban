import { ChipButton } from '#primitives/ChipButton'
import { Popover } from '#primitives/Popover'
import {
  type FieldCatalog,
  type FieldList,
  type ViewFields,
  orderedFields,
  shownFields,
  t,
  tidyFields,
  viewFieldLabel
} from '@low-level-kanban/core'
import { renderVisibilityList } from '../visibilityList'

export interface FieldsPopoverProps {
  /** Edited in place. */
  fields: ViewFields
  catalog: FieldCatalog
  onChange: () => void
}

/** The fields a board card shows, in their saved order. */
export function renderFieldsPanel(parent: HTMLElement, props: FieldsPopoverProps): void {
  const root = parent.createDiv('llk-fields-pop')
  const { fields, catalog } = props
  const body = root.createDiv('llk-fields-body')
  const mode = 'kanban'

  const list = (): FieldList => (fields.kanban ??= { visible: shownFields(fields, mode, catalog) })

  const changed = (): void => {
    tidyFields(fields, catalog)
    render()
    props.onChange()
  }

  const label = (id: string): string => viewFieldLabel(id, catalog.customFields)

  const render = (): void => {
    body.empty()
    const all = orderedFields(fields, mode, catalog)
    const shown = shownFields(fields, mode, catalog)

    renderVisibilityList(body, {
      rows: all.map((id) => ({
        id,
        label: label(id),
        hidden: !shown.includes(id)
      })),
      showLabel: t('header.showField'),
      hideLabel: t('header.hideField'),
      onToggle: (id) => {
        const isShown = shown.includes(id)
        const nextShown = isShown ? shown.filter((f) => f !== id) : [...shown, id]
        list().visible = all.filter((f) => nextShown.includes(f))
        changed()
      },
      onReorder: (ids) => {
        list().order = ids
        list().visible = ids.filter((id) => shown.includes(id))
        changed()
      }
    })

    const foot = body.createDiv('llk-fields-foot llk-pop-section')
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
