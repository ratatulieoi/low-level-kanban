import { setTooltip } from '#platform'
import { displayName, stringToColor } from '@low-level-kanban/core'
import { makeActivatable } from '#dom'

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return raw.toUpperCase()
}

export class Avatar {
  el: HTMLSpanElement
  private color: string | undefined

  constructor(parentEl: HTMLElement) {
    this.el = parentEl.createSpan({ cls: 'llk-avatar' })
  }

  setName(name: string): this {
    const display = displayName(name)
    this.el.setText(initialsFor(display))
    this.el.setCssProps({ '--llk-avatar-color': this.color ?? stringToColor(display) })
    setTooltip(this.el, display)
    return this
  }

  /** Replaces the color derived from the name; `undefined` keeps it. */
  setColor(color: string | undefined): this {
    if (!color) return this
    this.color = color
    this.el.setCssProps({ '--llk-avatar-color': color })
    return this
  }

  setSize(size: 'md' | 'sm'): this {
    this.el.toggleClass('llk-avatar--sm', size === 'sm')
    return this
  }

  setUnresolved(unresolved: boolean): this {
    this.el.toggleClass('llk-avatar--unresolved', unresolved)
    return this
  }

  onClick(handler: () => void): this {
    this.el.addClass('llk-avatar--link')
    makeActivatable(this.el, handler)
    return this
  }
}
