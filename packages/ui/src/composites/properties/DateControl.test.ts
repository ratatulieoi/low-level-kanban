// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderDateControl } from './DateControl'

describe('renderDateControl', () => {
  let container: HTMLElement

  beforeEach(() => {
    document.body.empty()
    container = document.body.createDiv()
  })

  it('renders trigger button with label and hidden date input', () => {
    const onChange = vi.fn<(value: string) => void>()
    renderDateControl({
      container,
      value: '2026-10-15',
      onChange
    })

    const trigger = container.find('button.llk-prop-inline')
    expect(trigger).not.toBeNull()
    expect(trigger?.classList.contains('llk-prop-inline--empty')).toBe(false)

    const label = trigger?.find('.llk-prop-inline-label')
    expect(label?.textContent).toBeTruthy()

    const hiddenInput = trigger?.find('input.llk-date-hidden-input') as HTMLInputElement | null
    expect(hiddenInput).not.toBeNull()
    expect(hiddenInput?.type).toBe('date')
    expect(hiddenInput?.value).toBe('2026-10-15')
  })

  it('renders empty label when value is empty', () => {
    const onChange = vi.fn<(value: string) => void>()
    renderDateControl({
      container,
      value: '',
      emptyLabel: 'Set date',
      onChange
    })

    const trigger = container.find('button.llk-prop-inline')
    expect(trigger?.classList.contains('llk-prop-inline--empty')).toBe(true)
    const label = trigger?.find('.llk-prop-inline-label')
    expect(label?.textContent).toBe('Set date')
  })

  it('calls onChange when the hidden date input changes', () => {
    const onChange = vi.fn<(value: string) => void>()
    renderDateControl({
      container,
      value: '2026-10-15',
      onChange
    })

    const hiddenInput = container.find('input.llk-date-hidden-input') as HTMLInputElement | null
    expect(hiddenInput).not.toBeNull()
    if (hiddenInput) {
      hiddenInput.value = '2026-10-20'
      hiddenInput.dispatchEvent(new Event('change'))
    }

    expect(onChange).toHaveBeenCalledWith('2026-10-20')
  })

  it('invokes showPicker on click without throwing when supported or mocked', () => {
    const onChange = vi.fn<(value: string) => void>()
    renderDateControl({
      container,
      value: '2026-10-15',
      onChange
    })

    const hiddenInput = container.find('input.llk-date-hidden-input') as HTMLInputElement | null
    const showPickerMock = vi.fn<() => void>()
    if (hiddenInput) {
      hiddenInput.showPicker = showPickerMock
    }

    const trigger = container.find('button.llk-prop-inline')
    trigger?.click()

    expect(showPickerMock).toHaveBeenCalledTimes(1)
  })
})
