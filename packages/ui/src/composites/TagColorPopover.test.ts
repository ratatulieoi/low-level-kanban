// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openTagColorPopover, TAG_PALETTE_COLORS } from './TagColorPopover'
import { renderMultiSelect } from './properties/MultiSelectControl'

describe('TagColorPopover', () => {
  let anchorEl: HTMLElement

  beforeEach(() => {
    document.body.empty()
    anchorEl = document.body.createDiv()
  })

  it('renders tag title, palette swatches, and custom color input', () => {
    const onColorChange = vi.fn<(newColor: string | null) => void>()
    const pop = openTagColorPopover({
      anchorEl,
      tag: 'urgent',
      currentColor: TAG_PALETTE_COLORS[0],
      hasCustomColor: false,
      onColorChange
    })

    const titleEl = pop.contentEl.find('.llk-tag-color-title')
    expect(titleEl?.textContent).toBe('#urgent')

    const swatches = pop.contentEl.findAll('.llk-tag-color-swatch')
    expect(swatches.length).toBe(TAG_PALETTE_COLORS.length)
    expect(swatches[0]?.classList.contains('is-active')).toBe(true)

    // Reset button should not be present when hasCustomColor is false
    expect(pop.contentEl.find('.llk-tag-color-reset')).toBeNull()

    pop.close()
  })

  it('selects a swatch and fires onColorChange', () => {
    const onColorChange = vi.fn<(newColor: string | null) => void>()
    const pop = openTagColorPopover({
      anchorEl,
      tag: 'feature',
      hasCustomColor: false,
      onColorChange
    })

    const targetSwatch = pop.contentEl.findAll('.llk-tag-color-swatch')[2]
    expect(targetSwatch).toBeDefined()
    targetSwatch?.click()

    expect(onColorChange).toHaveBeenCalledWith(TAG_PALETTE_COLORS[2])
  })

  it('allows resetting to auto when hasCustomColor is true', () => {
    const onColorChange = vi.fn<(newColor: string | null) => void>()
    const pop = openTagColorPopover({
      anchorEl,
      tag: 'backend',
      currentColor: '#123456',
      hasCustomColor: true,
      onColorChange
    })

    const resetBtn = pop.contentEl.find('.llk-tag-color-reset')
    expect(resetBtn).not.toBeNull()
    resetBtn?.click()

    expect(onColorChange).toHaveBeenCalledWith(null)
  })

  it('handles custom color input changes', () => {
    const onColorChange = vi.fn<(newColor: string | null) => void>()
    const pop = openTagColorPopover({
      anchorEl,
      tag: 'ui',
      currentColor: '#ff0000',
      onColorChange
    })

    const input = pop.contentEl.find('.llk-tag-color-input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    if (input) {
      input.value = '#00ff00'
      input.dispatchEvent(new Event('change'))
    }

    expect(onColorChange).toHaveBeenCalledWith('#00ff00')
  })
})

describe('MultiSelectControl with onItemClick', () => {
  it('invokes onItemClick when a tag chip is clicked, and does not fire onItemClick on remove', () => {
    document.body.empty()
    const container = document.body.createDiv()
    const onItemClick = vi.fn<(id: string, anchorEl: HTMLElement, rerender: () => void) => void>()
    const onRemove = vi.fn<(id: string) => void>()

    renderMultiSelect({
      container,
      tag: true,
      addLabel: 'Add tags',
      selected: () => ['alpha', 'beta'],
      options: () => [
        { id: 'alpha', label: 'alpha' },
        { id: 'beta', label: 'beta' }
      ],
      add: vi.fn<(id: string) => void>(),
      remove: onRemove,
      onItemClick
    })

    const chips = container.findAll('.llk-chip')
    expect(chips.length).toBe(2)
    expect(chips[0]?.classList.contains('llk-chip--interactive')).toBe(true)

    // Clicking chip fires onItemClick
    chips[0]?.click()
    expect(onItemClick).toHaveBeenCalledWith('alpha', chips[0], expect.any(Function))

    // Clicking remove button does not fire onItemClick again
    const rmBtn = chips[0]?.find('.llk-chip-rm')
    expect(rmBtn).not.toBeNull()
    rmBtn?.click()

    expect(onRemove).toHaveBeenCalledWith('alpha')
    expect(onItemClick).toHaveBeenCalledTimes(1)
  })
})
