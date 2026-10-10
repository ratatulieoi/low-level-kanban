import { Chip } from '#primitives/Chip'

export type DueUrgency = 'normal' | 'near' | 'overdue'

/** Yellow when normal, orange when near, solid red when overdue. The caller formats the label. */
export function renderDueChip(parent: HTMLElement, label: string, urgency: DueUrgency, size: 'md' | 'sm' = 'md'): Chip {
  const chip = new Chip(parent).setLabel(label).setSize(size)
  if (urgency === 'near') {
    chip.setVariant('solid').setColor('var(--color-orange)')
  } else if (urgency === 'overdue') {
    chip.setVariant('solid').setColor('var(--color-red)').setStrong()
  } else {
    chip.setColor('var(--color-yellow, #facc15)')
  }
  return chip
}
