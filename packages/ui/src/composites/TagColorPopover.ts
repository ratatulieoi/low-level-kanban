import { Popover } from '#primitives/Popover'
import { t } from '@low-level-kanban/core'

export const TAG_PALETTE_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#64748b'
]

export interface TagColorPopoverOptions {
  anchorEl: HTMLElement
  tag: string
  currentColor?: string
  hasCustomColor?: boolean
  onColorChange: (newColor: string | null) => void
}

export function openTagColorPopover(opts: TagColorPopoverOptions): Popover {
  const pop = new Popover({ anchor: opts.anchorEl, width: 200 })
  const { contentEl } = pop

  const panel = contentEl.createDiv('llk-tag-color-pop')

  const head = panel.createDiv('llk-tag-color-head')
  head.createSpan({ text: `#${opts.tag}`, cls: 'llk-tag-color-title' })

  if (opts.hasCustomColor) {
    const resetBtn = head.createEl('button', {
      cls: 'llk-tag-color-reset',
      text: t('settings.tagColors.reset')
    })
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      opts.onColorChange(null)
      pop.close()
    })
  }

  const grid = panel.createDiv('llk-tag-color-grid')
  for (const color of TAG_PALETTE_COLORS) {
    const swatch = grid.createEl('button', {
      cls: 'llk-tag-color-swatch',
      attr: { 'aria-label': color }
    })
    swatch.style.backgroundColor = color
    if (opts.currentColor && opts.currentColor.toLowerCase() === color.toLowerCase()) {
      swatch.addClass('is-active')
    }
    swatch.addEventListener('click', (e) => {
      e.stopPropagation()
      opts.onColorChange(color)
      pop.close()
    })
  }

  const customRow = panel.createDiv('llk-tag-color-custom')
  const label = customRow.createEl('label')
  label.createSpan({ text: t('settings.tagColors.custom') })

  const colorInput = customRow.createEl('input', {
    cls: 'llk-tag-color-input',
    attr: { type: 'color' }
  })
  if (opts.currentColor && /^#[0-9a-fA-F]{6}$/.test(opts.currentColor)) {
    colorInput.value = opts.currentColor
  }
  colorInput.addEventListener('change', (e) => {
    e.stopPropagation()
    opts.onColorChange(colorInput.value)
    pop.close()
  })

  pop.open()
  return pop
}
