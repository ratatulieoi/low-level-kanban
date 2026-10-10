import { stringToColor } from '@low-level-kanban/core'
import { Chip } from '#primitives/Chip'

/** An explicit color wins; otherwise the tag falls back to its automatic color. */
export function renderTagChip(parent: HTMLElement, tag: string, colored: boolean, color?: string): Chip {
  const chip = new Chip(parent).setLabel(tag).setVariant('outline').setTag()
  if (colored) chip.setDot(true).setColor(color ?? stringToColor(tag))
  return chip
}
