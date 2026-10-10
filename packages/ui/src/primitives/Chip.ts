import { setIcon, setTooltip } from '#platform'

export type ChipVariant = 'solid' | 'outline' | 'plain'

export class Chip {
  el: HTMLElement
  private labelEl: HTMLElement
  private dotEl: HTMLElement | null = null
  private iconEl: HTMLElement | null = null

  constructor(parentEl: HTMLElement) {
    this.el = parentEl.createSpan({ cls: 'llk-chip' })
    this.labelEl = this.el.createSpan({ cls: 'llk-chip-label' })
  }

  setLeadingIcon(name: string): this {
    if (!this.iconEl) {
      this.iconEl = this.el.createSpan({ cls: 'llk-chip-icon' })
      this.el.prepend(this.iconEl)
    }
    setIcon(this.iconEl, name)
    return this
  }

  setLabel(text: string): this {
    this.labelEl.setText(text)
    return this
  }

  setColor(color: string): this {
    this.el.style.setProperty('--llk-chip-color', color)
    return this
  }

  setVariant(variant: ChipVariant): this {
    this.el.toggleClass('llk-chip--solid', variant === 'solid')
    this.el.toggleClass('llk-chip--outline', variant === 'outline')
    this.el.toggleClass('llk-chip--plain', variant === 'plain')
    return this
  }

  setDot(show = true): this {
    if (show && !this.dotEl) {
      this.dotEl = this.el.createSpan({ cls: 'llk-chip-dot' })
      this.el.prepend(this.dotEl)
    } else if (!show && this.dotEl) {
      this.dotEl.remove()
      this.dotEl = null
    }
    return this
  }

  setTag(isTag = true): this {
    this.el.toggleClass('llk-chip--tag', isTag)
    return this
  }

  setStrong(strong = true): this {
    this.el.toggleClass('llk-chip--strong', strong)
    return this
  }

  setShape(shape: 'rounded' | 'pill'): this {
    this.el.toggleClass('llk-chip--pill', shape === 'pill')
    return this
  }

  setSize(size: 'md' | 'sm'): this {
    this.el.toggleClass('llk-chip--sm', size === 'sm')
    return this
  }

  setTooltip(text: string): this {
    setTooltip(this.el, text)
    return this
  }

  setRemovable(onRemove: () => void, label?: string): this {
    const rmBtn = this.el.createEl('button', { cls: 'llk-chip-rm' })
    setIcon(rmBtn, 'x')
    if (label) {
      rmBtn.setAttribute('aria-label', label)
      setTooltip(rmBtn, label)
    }
    rmBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      onRemove()
    }
    return this
  }

  onClick(handler: (e: MouseEvent) => unknown): this {
    this.el.addClass('llk-chip--interactive')
    this.el.addEventListener('click', handler)
    return this
  }
}
