import { t } from '@low-level-kanban/core'
import { setIcon } from '#platform'
import { renderAddButton } from '../addButton'
import { Popover } from '#primitives/Popover'

export interface HiddenProperty {
  id: string
  label: string
  icon: string
}

/** Lists the properties currently hidden for being empty, and reveals the chosen one. */
export function renderAddProperty(
  container: HTMLElement,
  hidden: HiddenProperty[],
  onShow: (id: string) => void
): void {
  if (hidden.length === 0) return
  let pop: Popover | null = null
  const btn = renderAddButton(container, t('property.add'), () => {
    if (pop?.isOpen) {
      pop.close()
      return
    }
    pop = new Popover({ anchor: btn, width: 190, onClose: () => (pop = null) })
    const list = pop.contentEl.createDiv('llk-pop-list')
    for (const h of hidden) {
      const item = list.createEl('button', { cls: 'llk-pop-item' })
      const ic = item.createSpan({ cls: 'llk-glyph-icon' })
      setIcon(ic, h.icon)
      item.createSpan({ cls: 'llk-pop-item-label', text: h.label })
      item.addEventListener('click', () => {
        pop?.close()
        onShow(h.id)
      })
    }
    pop.open()
  })
}
