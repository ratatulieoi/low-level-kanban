import { describe, expect, it } from 'vitest'
import type { CustomFieldDef, ViewFields } from '../types'
import {
  availableFields,
  defaultFields,
  hiddenFields,
  legacyBoardFields,
  shownFields,
  tidyFields,
  viewFieldLabel,
  withFieldShown
} from './ViewFields'

const client: CustomFieldDef = { id: 'client', name: 'Client', type: 'text' }
const one = { customFields: [client], multi: false }
const many = { customFields: [client], multi: true }

describe('view fields', () => {
  it('offers the project only while a board spans projects', () => {
    expect(availableFields('kanban', one)).not.toContain('project')
    expect(availableFields('kanban', many)).toContain('project')
    expect(availableFields('kanban', one).at(-1)).toBe('cf:client')
  })

  it('leaves custom fields, description and subtasks hidden by default', () => {
    expect(defaultFields('kanban', one)).not.toContain('cf:client')
    expect(defaultFields('kanban', one)).not.toContain('description')
    expect(defaultFields('kanban', one)).not.toContain('subtasks')
  })

  it('keeps card field order and drops fields that no longer exist', () => {
    const fields: ViewFields = { kanban: { visible: ['due', 'cf:gone', 'priority'] } }
    expect(shownFields(fields, 'kanban', one)).toEqual(['due', 'priority'])
    expect(hiddenFields(fields, 'kanban', one)).toEqual([
      'description',
      'time',
      'tags',
      'progress',
      'assignees',
      'subtasks',
      'cf:client'
    ])
  })

  it('lets every card field be hidden', () => {
    expect(shownFields({ kanban: { visible: [] } }, 'kanban', one)).toEqual([])
  })

  it('forgets fields put back to their defaults', () => {
    const fields: ViewFields = { kanban: { visible: defaultFields('kanban', one) } }
    tidyFields(fields, one)
    expect(fields).toEqual({})
  })

  it('drops legacy modes and widths before consulting the board catalog', () => {
    const fields = {
      table: { visible: ['title'], widths: { due: 90 } },
      gantt: { visible: ['title', 'dates'] },
      calendar: { visible: ['due'] },
      kanban: { visible: ['due', 'cf:client'], widths: { due: 80 } }
    }
    tidyFields(fields, one)
    expect(fields).toEqual({ kanban: { visible: ['due', 'cf:client'] } })
    tidyFields(fields, one)
    expect(fields).toEqual({ kanban: { visible: ['due', 'cf:client'] } })
  })

  it('handles legacy-only and malformed field state', () => {
    for (const raw of [{ table: { visible: ['title'] } }, { gantt: null }, { kanban: { visible: 'due' } }]) {
      const fields = raw as unknown as ViewFields
      expect(() => tidyFields(fields, one)).not.toThrow()
      expect(fields).toEqual({})
    }
  })

  it('turns the old board settings into card fields', () => {
    expect(legacyBoardFields(false, false)).toEqual({})
    const shown = shownFields(legacyBoardFields(true, true), 'kanban', one)
    expect(shown).toContain('subtasks')
    expect(shown).toContain('description')
    expect(shownFields(legacyBoardFields(false, true), 'kanban', one)).not.toContain('subtasks')
  })

  it('names custom fields by their name', () => {
    expect(viewFieldLabel('cf:client', [client])).toBe('Client')
    expect(viewFieldLabel('due', [])).toBe('Due')
  })
})

describe('withFieldShown', () => {
  const order = ['a', 'b', 'c', 'd']

  it('puts a field back between the ones around it in the order', () => {
    expect(withFieldShown(['a', 'c', 'd'], 'b', order)).toEqual(['a', 'b', 'c', 'd'])
    expect(withFieldShown(['b', 'c'], 'a', order)).toEqual(['a', 'b', 'c'])
    expect(withFieldShown(['a', 'b'], 'd', order)).toEqual(['a', 'b', 'd'])
  })

  it('keeps a reordered list as it is around the field', () => {
    expect(withFieldShown(['d', 'a'], 'c', order)).toEqual(['c', 'd', 'a'])
    expect(withFieldShown([], 'b', order)).toEqual(['b'])
  })
})
