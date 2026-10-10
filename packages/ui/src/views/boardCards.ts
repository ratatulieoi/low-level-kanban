import {
  type CustomFieldDef,
  type Task,
  formatDateLong,
  stringifyCustomValue,
  stripChecklist,
  t
} from '@low-level-kanban/core'
import type { CardFieldValue } from '../composites/KanbanCard'

/** The tasks a board deals cards for: top-level tasks only. */
export function boardCandidates(tasks: Task[], _fields: string[] = []): Task[] {
  return tasks
}

/** A description as one line of plain text, cut to what a card has room for. Subtasks are excluded. */
export function descriptionPreview(markdown: string): string | undefined {
  const prose = stripChecklist(markdown)
  const text = prose
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*[#>\-*+]+[ \t]+/gm, '')
    .replace(/[*~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, 240) : undefined
}

/** The custom fields among `fields`, as the card shows them. */
export function cardCustomValues(
  task: Task,
  customFields: CustomFieldDef[],
  fields: string[]
): Record<string, CardFieldValue> {
  const values: Record<string, CardFieldValue> = {}
  for (const cf of customFields) {
    const id = `cf:${cf.id}`
    const raw = task.customFields[cf.id]
    if (!fields.includes(id) || raw === undefined || raw === null || raw === '') continue
    const list = (Array.isArray(raw) ? raw : [raw]).map(stringifyCustomValue).filter(Boolean)
    const text =
      cf.type === 'checkbox'
        ? raw === true
          ? t('common.yes')
          : ''
        : cf.type === 'date'
          ? list.map((value) => formatDateLong(value) || value).join(', ')
          : list.map((value) => value.replace(/^\[\[(?:[^|\]]*\|)?([^\]]*)\]\]$/, '$1')).join(', ')
    if (text) values[id] = { name: cf.name, text }
  }
  return values
}
