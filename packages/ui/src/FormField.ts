import { setIcon } from './platform'

export function renderPropRow(
  container: HTMLElement,
  label: string,
  valueBuilder: () => HTMLElement,
  icon?: string
): HTMLElement {
  const row = container.createDiv('llk-prop-row')
  const labelEl = row.createSpan({ cls: 'llk-prop-label' })
  if (icon) {
    labelEl.addClass('llk-prop-label--with-icon')
    const iconEl = labelEl.createSpan({ cls: 'llk-prop-label-icon' })
    setIcon(iconEl, icon)
    labelEl.createSpan({ text: label })
  } else {
    labelEl.setText(label)
  }
  const valueEl = valueBuilder()
  row.appendChild(valueEl)
  return row
}
