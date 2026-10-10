import { setIcon } from '#platform'
import { formatDate, type DueTone, t } from '@low-level-kanban/core'

export interface DateControlOpts {
  container: HTMLElement
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  hint?: { text: string; tone: DueTone } | null
}

/** Backs Due, Start, and Completed. */
export function renderDateControl(opts: DateControlOpts): void {
  const has = !!opts.value
  const trigger = opts.container.createEl('button', { cls: 'llk-prop-inline' })
  if (!has) trigger.addClass('llk-prop-inline--empty')
  const icon = trigger.createSpan({ cls: 'llk-glyph-icon' })
  setIcon(icon, 'calendar')
  trigger.createSpan({
    cls: 'llk-prop-inline-label',
    text: has ? formatDate(opts.value) : (opts.emptyLabel ?? t('taskForm.setDate'))
  })
  if (opts.hint) trigger.createSpan({ cls: `llk-due llk-due--${opts.hint.tone}`, text: opts.hint.text })

  // Hidden date input lives on the trigger so showPicker() can open the native calendar
  // without a popover or text field being visible.
  const field = trigger.createEl('input', {
    type: 'date',
    cls: 'llk-date-hidden-input'
  })
  field.value = opts.value

  field.addEventListener('change', () => {
    if (field.value !== opts.value) opts.onChange(field.value)
  })

  trigger.addEventListener('click', (e) => {
    e.preventDefault()
    try {
      field.showPicker()
    } catch {
      /* showPicker() throws in non-interactive contexts (tests, older browsers) */
    }
  })
}
