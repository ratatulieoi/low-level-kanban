// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  makeDefaultFilter,
  makeTask,
  type CustomFieldDef,
  type GroupState,
  type SortRule,
  type FilterState,
  type ProjectListField,
  type ProjectListFilter,
  type ViewFields
} from '@low-level-kanban/core'
import { setPlatform } from '#platform'
import { domPlatform } from '../../dom-platform'
import { ChipButton } from '#primitives/ChipButton'
import { SplitButton } from '#primitives/SplitButton'
import { renderBreadcrumb } from './Breadcrumb'
import { FilterBar } from './FilterBar'
import { openFieldsPopover } from './fieldsPopover'
import { openFilterPopover, renderFilterPanel, type FilterSetup } from './filterPopover'
import { openGroupPopover } from './groupPopover'
import { openProjectFieldsPopover } from './projectFieldsPopover'
import { openProjectFilterPopover, renderProjectFilterPanel } from './projectFilterPopover'
import { openProjectSwitcher, type ProjectSwitcherProps, type SwitcherProject } from './projectSwitcher'
import { openSavedViewsPopover, type SavedViewsProps } from './savedViewsPopover'
import type { BoardColumn } from '../../views/boardColumns'
import { openSearchPopover, SearchBox } from './SearchBox'
import { openSortPopover, type SortField } from './sortPopover'
import type { TuneItem } from './tunePopover'
import { openTuneSheet, type TuneSheetProps } from './tuneSheet'
import { ViewHeader } from './ViewHeader'

function noop(): void {}

const FIELDS: CustomFieldDef[] = [
  { id: 'estimate', name: 'Estimate', type: 'number' },
  { id: 'secret', name: 'Secret', type: 'text', filterable: false }
]

const TASKS = [
  makeTask({ id: 'a', status: 'todo', assignees: ['Ada'] }),
  makeTask({ id: 'b', status: 'todo' }),
  makeTask({ id: 'c', status: 'done', archived: true })
]

function setupFor(filter: FilterState): FilterSetup {
  return {
    filter,
    tasks: TASKS,
    ctx: { statuses: DEFAULT_STATUSES, customFields: FIELDS },
    priorities: DEFAULT_PRIORITIES,
    priorityIcons: 'chevrons',
    projects: []
  }
}

function mountBar(filter: FilterState, onChange = vi.fn<() => void>()): FilterBar {
  return new FilterBar(document.body.createDiv(), {
    ...setupFor(filter),
    summary: '1 of 3 shown',
    onChange,
    onClose: noop
  })
}

const visibleChips = (bar: FilterBar): HTMLElement[] => bar.el.findAll('.llk-filter-chip:not(.llk-hidden)')

const menuTitles = (): string[] => document.body.findAll('.menu .menu-item-title').map((item) => item.textContent ?? '')

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  document.body.empty()
})

describe('ChipButton', () => {
  it('keeps icon, label, badge and chevron in that order whatever order they are set in', () => {
    const button = new ChipButton(document.body)
      .setChevron(true)
      .setBadge('2')
      .setLabel('Filter')
      .setIcon('list-filter')
    expect(Array.from(button.el.children).map((child) => child.className)).toEqual([
      'llk-chip-btn-icon',
      'llk-chip-btn-label',
      'llk-chip-btn-badge',
      'llk-chip-btn-chevron'
    ])
    button.setBadge('')
    expect(button.el.find('.llk-chip-btn-badge')).toBeNull()
  })

  it('is square only while its icon is all it shows', () => {
    const button = new ChipButton(document.body).setIcon('sliders-horizontal').setLabel('')
    expect(button.el.hasClass('llk-chip-btn--icon-only')).toBe(true)
    button.setBadge('3')
    expect(button.el.hasClass('llk-chip-btn--icon-only')).toBe(false)
    button.setBadge('')
    expect(button.el.hasClass('llk-chip-btn--icon-only')).toBe(true)
    button.setLabel('Filter')
    expect(button.el.hasClass('llk-chip-btn--icon-only')).toBe(false)
  })
})

describe('SplitButton', () => {
  it('hands the chevron to the menu handler, to open the menu under it', () => {
    const onMenu = vi.fn<(anchor: HTMLElement) => void>()
    const button = new SplitButton(document.body).setLabel('Add task').onMenu('More to add', onMenu)
    const chevron = button.el.find('.llk-split-btn-menu')
    chevron?.click()
    expect(onMenu).toHaveBeenCalledWith(chevron)
  })
})

describe('FilterBar', () => {
  it('describes each condition as field, operator and value', () => {
    const filter: FilterState = {
      showArchived: false,
      conditions: [
        { field: 'status', op: 'any', value: ['todo', 'in-progress'] },
        { field: 'due', op: 'bucket', value: 'overdue' },
        { field: 'cf:estimate', op: 'between', value: [2, 8] },
        { field: 'tag', op: 'empty' }
      ]
    }
    const bar = mountBar(filter)
    const chips = visibleChips(bar)
    expect(chips.map((chip) => chip.find('.llk-filter-chip-op')?.textContent)).toEqual([
      'is any of',
      'is',
      'is between',
      'is empty'
    ])
    expect(chips.map((chip) => chip.find('.llk-filter-chip-value')?.textContent)).toEqual([
      `${DEFAULT_STATUSES[0].label}, ${DEFAULT_STATUSES[1].label}`,
      'Overdue',
      '2 to 8',
      ''
    ])
    expect(chips[3].find('.llk-filter-chip-value')?.hasClass('llk-hidden')).toBe(true)
    expect(bar.el.find('.llk-filter-bar-summary')?.textContent).toBe('1 of 3 shown')
  })

  it('removes a condition and clears them all', () => {
    const onChange = vi.fn<() => void>()
    const filter: FilterState = {
      showArchived: true,
      conditions: [
        { field: 'status', op: 'any', value: ['todo'] },
        { field: 'priority', op: 'any', value: ['high'] }
      ]
    }
    const bar = mountBar(filter, onChange)
    expect(visibleChips(bar).length).toBe(3)
    bar.el.find('.llk-filter-chip-remove')?.click()
    expect(filter.conditions.map((c) => c.field)).toEqual(['priority'])
    expect(visibleChips(bar).length).toBe(2)

    bar.el.find('.llk-filter-bar-clear')?.click()
    expect(filter.conditions).toEqual([])
    expect(filter.showArchived).toBe(false)
    expect(visibleChips(bar).length).toBe(0)
    expect(bar.el.find('.llk-filter-bar-clear')?.hasClass('llk-hidden')).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('offers the built-in fields and every custom field not opted out', () => {
    mountBar(makeDefaultFilter()).openPicker()
    const labels = document.body.findAll('.llk-filter-pop .llk-pop-item-label').map((el) => el.textContent)
    expect(labels).toEqual([
      'Status',
      'Priority',
      'Assignee',
      'Tag',
      'Due date',
      'Start date',
      'Type',
      'Title',
      'Estimate',
      'Include archived'
    ])
  })

  it('adds a condition from the value list, with counts that leave archived tasks out', () => {
    const filter = makeDefaultFilter()
    const bar = mountBar(filter)
    bar.openPicker()
    document.body.findAll('.llk-filter-pop .llk-pop-item')[0].click()
    const rows = document.body.findAll('.llk-filter-pop-value .llk-pop-item')
    const todo = rows.find((row) => row.find('.llk-pop-item-label')?.textContent === DEFAULT_STATUSES[0].label)
    const done = rows.find((row) => row.find('.llk-pop-item-label')?.textContent === 'Done')
    expect(todo?.find('.llk-pop-item-note')?.textContent).toBe('2')
    expect(done?.find('.llk-pop-item-note')?.textContent).toBe('0')
    todo?.click()
    expect(filter.conditions).toEqual([{ field: 'status', op: 'any', value: ['todo'] }])
    expect(visibleChips(bar).length).toBe(1)
  })

  it('edits a condition in place from its chip', () => {
    const filter: FilterState = { showArchived: false, conditions: [{ field: 'status', op: 'any', value: ['todo'] }] }
    const bar = mountBar(filter)
    visibleChips(bar)[0].querySelector<HTMLButtonElement>('.llk-filter-chip-op')?.click()
    const ops = document.body.findAll('.llk-filter-pop-op')
    ops.find((op) => op.textContent === 'is none of')?.click()
    expect(filter.conditions).toEqual([{ field: 'status', op: 'none', value: ['todo'] }])
    expect(visibleChips(bar)[0].find('.llk-filter-chip-op')?.textContent).toBe('is not')
  })

  it('drops a condition whose values are cleared', () => {
    const filter: FilterState = { showArchived: false, conditions: [{ field: 'status', op: 'any', value: ['todo'] }] }
    const bar = mountBar(filter)
    visibleChips(bar)[0].querySelector<HTMLButtonElement>('.llk-filter-chip-value')?.click()
    document.body
      .findAll('.llk-filter-pop-value .llk-pop-item')
      .find((row) => row.find('.llk-pop-item-label')?.textContent === DEFAULT_STATUSES[0].label)
      ?.click()
    expect(filter.conditions).toEqual([])
    expect(visibleChips(bar).length).toBe(0)
  })

  it('filters by text as it is typed', () => {
    const filter = makeDefaultFilter()
    const bar = mountBar(filter)
    bar.openPicker()
    document.body
      .findAll('.llk-filter-pop .llk-pop-item')
      .find((row) => row.find('.llk-pop-item-label')?.textContent === 'Title')
      ?.click()
    const input = document.body.querySelector<HTMLInputElement>('.llk-filter-pop-value input')
    if (!input) throw new Error('no text field')
    input.value = 'copy'
    input.dispatchEvent(new Event('input'))
    expect(filter.conditions).toEqual([{ field: 'title', op: 'contains', value: 'copy' }])
  })

  it('names how many filters apply on the button that stands in for the chips', () => {
    const filter: FilterState = { showArchived: true, conditions: [{ field: 'status', op: 'any', value: ['todo'] }] }
    const bar = mountBar(filter)
    expect(bar.el.find('.llk-filter-bar-list')?.textContent).toBe('2 filters')
    bar.el.find('.llk-filter-bar-clear')?.click()
    expect(bar.el.find('.llk-filter-bar-list')?.textContent).toBe('Add filter')
  })

  it('lists the applied conditions, edits one and goes back to the list', () => {
    const onChange = vi.fn<() => void>()
    const filter: FilterState = {
      showArchived: false,
      conditions: [
        { field: 'status', op: 'any', value: ['todo'] },
        { field: 'due', op: 'bucket', value: 'overdue' }
      ]
    }
    openFilterPopover(document.body.createDiv(), setupFor(filter), onChange, 'list')
    const rows = (): HTMLElement[] => document.body.findAll('.llk-filter-list-row')
    expect(rows().map((row) => row.find('.llk-pop-item-note')?.textContent)).toEqual([
      `is ${DEFAULT_STATUSES[0].label}`,
      'is Overdue'
    ])
    rows()[1].find('.llk-pop-item')?.click()
    expect(document.body.find('.llk-pop-title')?.textContent).toBe('Due date')
    document.body.find('.llk-pop-head--title .llk-icon-btn')?.click()
    expect(rows().length).toBe(2)

    rows()[0].find('.llk-filter-list-remove')?.click()
    expect(filter.conditions.map((c) => c.field)).toEqual(['due'])
    expect(rows().length).toBe(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('opens the list on the field picker while nothing applies, with a way back', () => {
    const filter = makeDefaultFilter()
    openFilterPopover(document.body.createDiv(), setupFor(filter), noop, 'list')
    expect(document.body.find('.llk-pop-title')?.textContent).toBe('Add filter')
    document.body.find('.llk-pop-head--title .llk-icon-btn')?.click()
    expect(document.body.find('.llk-pop-item--accent')?.textContent).toContain('Add filter')
    expect(document.body.find('.llk-filter-list-foot')).toBeNull()
  })

  it('leaves Clear all out of the list for a host that has its own', () => {
    const filter: FilterState = { showArchived: false, conditions: [{ field: 'status', op: 'any', value: ['todo'] }] }
    renderFilterPanel(document.body.createDiv(), setupFor(filter), noop, 'list', { showClear: false })
    expect(document.body.findAll('.llk-filter-list-row').length).toBe(1)
    expect(document.body.find('.llk-filter-list-foot')).toBeNull()
  })
})

describe('saved views popover', () => {
  const views = [
    { id: 'v1', name: 'Mine', modeIcon: 'kanban' },
    { id: 'v2', name: 'Roadmap', isDefault: true }
  ]
  const props = (overrides: Partial<SavedViewsProps> = {}): SavedViewsProps => ({
    views,
    activeId: 'v2',
    changes: [],
    canSave: true,
    storageNote: 'Kept in the note of Alpha.',
    builtInName: 'All projects',
    onSelect: vi.fn<(id: string | null) => void>(),
    onSave: vi.fn<(name: string, isDefault: boolean) => Promise<void>>(async () => {}),
    onUpdate: vi.fn<(id: string) => Promise<void>>(async () => {}),
    onRevert: vi.fn<() => void>(),
    onRename: vi.fn<(id: string, name: string) => Promise<void>>(async () => {}),
    onDelete: vi.fn<(id: string) => Promise<void>>(async () => {}),
    onReorder: vi.fn<(ids: string[]) => Promise<void>>(async () => {}),
    onSetDefault: vi.fn<(id: string | null) => Promise<void>>(async () => {}),
    ...overrides
  })
  const rows = (): HTMLElement[] => document.body.findAll('.llk-saved-view-row')
  const action = (row: HTMLElement, label: string): HTMLButtonElement | null =>
    row.querySelector<HTMLButtonElement>(`.llk-saved-view-action[aria-label="${label}"]`)

  it('lists the built-in view first, marks the active one and stars the default', () => {
    openSavedViewsPopover(document.body.createEl('button'), props())
    const mains = document.body.findAll('.llk-saved-view-main')
    expect(mains.map((row) => row.find('.llk-pop-item-label')?.textContent)).toEqual([
      'All projects',
      'Mine',
      'Roadmap'
    ])
    expect(mains.map((row) => !row.find('.llk-pop-check')?.hasClass('llk-pop-check--hidden'))).toEqual([
      false,
      false,
      true
    ])
    expect(action(rows()[2], 'Opens with this view')?.hasClass('is-default')).toBe(true)
    expect(document.body.find('.llk-saved-views-dirty')).toBeNull()
  })

  it('offers update, save as new and revert while the active view has unsaved changes', async () => {
    const p = props({ changes: ['Filter', 'Sort'] })
    openSavedViewsPopover(document.body.createEl('button'), p)
    expect(document.body.find('.llk-saved-views-dirty-note')?.textContent).toBe('Unsaved changes: Filter, Sort')
    document.body.find('.llk-saved-views-dirty-actions .mod-cta')?.click()
    await vi.waitFor(() => expect(p.onUpdate).toHaveBeenCalledWith('v2'))

    openSavedViewsPopover(document.body.createEl('button'), p)
    document.body
      .querySelector<HTMLButtonElement>('.llk-saved-views-dirty-actions [aria-label="Revert changes"]')
      ?.click()
    expect(p.onRevert).toHaveBeenCalled()
  })

  it('selects, stars and deletes through its callbacks', async () => {
    const p = props()
    openSavedViewsPopover(document.body.createEl('button'), p)
    action(rows()[1], 'Delete view')?.click()
    await vi.waitFor(() => expect(p.onDelete).toHaveBeenCalledWith('v1'))

    openSavedViewsPopover(document.body.createEl('button'), p)
    action(rows()[1], 'Open with this view')?.click()
    await vi.waitFor(() => expect(p.onSetDefault).toHaveBeenCalledWith('v1'))

    openSavedViewsPopover(document.body.createEl('button'), p)
    action(rows()[2], 'Opens with this view')?.click()
    await vi.waitFor(() => expect(p.onSetDefault).toHaveBeenCalledWith(null))

    openSavedViewsPopover(document.body.createEl('button'), p)
    document.body.findAll('.llk-saved-view-main')[0].click()
    expect(p.onSelect).toHaveBeenCalledWith(null)
  })

  it('renames a view in place', async () => {
    const p = props()
    openSavedViewsPopover(document.body.createEl('button'), p)
    action(rows()[1], 'Rename view')?.click()
    const input = document.body.querySelector<HTMLInputElement>('.llk-saved-view-rename')
    if (!input) throw new Error('no rename field')
    expect(input.value).toBe('Mine')
    input.value = 'Only mine'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await vi.waitFor(() => expect(p.onRename).toHaveBeenCalledWith('v1', 'Only mine'))
  })

  it('reorders by dragging one view onto another', async () => {
    const p = props()
    openSavedViewsPopover(document.body.createEl('button'), p)
    rows()[2].dispatchEvent(new Event('dragstart'))
    rows()[1].dispatchEvent(new Event('drop'))
    await vi.waitFor(() => expect(p.onReorder).toHaveBeenCalledWith(['v2', 'v1']))
  })

  it('moves a view down onto the one below it', async () => {
    const p = props()
    openSavedViewsPopover(document.body.createEl('button'), p)
    rows()[1].dispatchEvent(new Event('dragstart'))
    rows()[2].dispatchEvent(new Event('drop'))
    await vi.waitFor(() => expect(p.onReorder).toHaveBeenCalledWith(['v2', 'v1']))
  })

  it('saves the current state under the typed name, as the default when asked', async () => {
    const p = props()
    openSavedViewsPopover(document.body.createEl('button'), p)
    document.body.querySelector<HTMLButtonElement>('.llk-saved-views-foot button')?.click()
    expect(document.body.find('.llk-saved-views-storage')?.textContent).toBe('Kept in the note of Alpha.')
    const input = document.body.querySelector<HTMLInputElement>('.llk-saved-views-foot input.llk-pop-field')
    const star = document.body.querySelector<HTMLInputElement>('.llk-saved-views-check input')
    if (!input || !star) throw new Error('no save form')
    input.value = 'Urgent only'
    star.checked = true
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await vi.waitFor(() => expect(p.onSave).toHaveBeenCalledWith('Urgent only', true))
  })

  it('refuses to save while nothing differs from the defaults', () => {
    openSavedViewsPopover(document.body.createEl('button'), props({ canSave: false }))
    expect(document.body.querySelector<HTMLButtonElement>('.llk-saved-views-foot button')?.disabled).toBe(true)
  })
})

describe('sort popover', () => {
  const fields: SortField[] = [
    { id: 'title', label: 'Task' },
    { id: 'status', label: 'Status', ends: ['To Do', 'Cancelled'] },
    { id: 'due', label: 'Due' }
  ]
  const open = (sort: SortRule[], onReset = vi.fn<() => void>()) => {
    const onChange = vi.fn<() => void>()
    openSortPopover(document.body.createEl('button'), { fields, sort, onChange, onReset })
    return onChange
  }
  const selects = (cls: string): HTMLSelectElement[] =>
    Array.from(document.body.querySelectorAll<HTMLSelectElement>(`select.${cls}`))

  it('adds keys up to the limit and names directions by field', () => {
    const sort: SortRule[] = [{ key: 'status', dir: 'asc' }]
    const onChange = open(sort)
    const add = (): void => document.body.querySelector<HTMLButtonElement>('.llk-sort-add')?.click()
    add()
    add()
    expect(sort.map((rule) => rule.key)).toEqual(['status', 'title', 'due'])
    expect(document.body.querySelector<HTMLButtonElement>('.llk-sort-add')?.disabled).toBe(true)
    expect(document.body.find('.llk-sort-pop-count')?.textContent).toBe('3 of 3')
    expect(Array.from(selects('llk-sort-dir')[2].options).map((o) => o.text)).toEqual([
      'Earliest first',
      'Latest first'
    ])
    expect(Array.from(selects('llk-sort-dir')[0].options).map((o) => o.text)).toEqual([
      'To Do first',
      'Cancelled first'
    ])
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('changes the field and the direction of a key, and removes one', () => {
    const sort: SortRule[] = [
      { key: 'status', dir: 'asc' },
      { key: 'title', dir: 'asc' }
    ]
    open(sort)
    const field = selects('llk-sort-field')[1]
    expect(Array.from(field.options).map((o) => o.value)).toEqual(['title', 'due'])
    field.value = 'due'
    field.dispatchEvent(new Event('change'))
    const dir = selects('llk-sort-dir')[0]
    dir.value = 'desc'
    dir.dispatchEvent(new Event('change'))
    expect(sort).toEqual([
      { key: 'status', dir: 'desc' },
      { key: 'due', dir: 'asc' }
    ])
    document.body.querySelector<HTMLButtonElement>('.llk-sort-remove')?.click()
    expect(sort).toEqual([{ key: 'due', dir: 'asc' }])
  })

  it('moves a key to another rank by dragging it', () => {
    const sort: SortRule[] = [
      { key: 'status', dir: 'asc' },
      { key: 'title', dir: 'asc' }
    ]
    open(sort)
    const rows = document.body.findAll('.llk-sort-row')
    rows[1].dispatchEvent(new Event('dragstart'))
    rows[0].dispatchEvent(new Event('drop'))
    expect(sort.map((rule) => rule.key)).toEqual(['title', 'status'])
  })

  it('moves a key down to the last rank', () => {
    const sort: SortRule[] = [
      { key: 'status', dir: 'asc' },
      { key: 'title', dir: 'asc' },
      { key: 'due', dir: 'desc' }
    ]
    open(sort)
    const rows = document.body.findAll('.llk-sort-row')
    rows[0].dispatchEvent(new Event('dragstart'))
    rows[2].dispatchEvent(new Event('drop'))
    expect(sort.map((rule) => rule.key)).toEqual(['title', 'due', 'status'])
  })

  it('resets through the view', () => {
    const onReset = vi.fn<() => void>()
    open([], onReset)
    expect(document.body.find('.llk-sort-pop .llk-pop-empty')).not.toBeNull()
    document.body.querySelector<HTMLButtonElement>('.llk-sort-pop .llk-pop-head-action')?.click()
    expect(onReset).toHaveBeenCalled()
  })
})

describe('group popover', () => {
  const columns = (group: GroupState): BoardColumn[] =>
    ['todo', 'doing', 'done'].map((id, index) => ({
      id,
      label: id,
      tasks: index === 2 ? [] : [makeTask({ id })],
      hidden: group.columns?.[group.field]?.hidden?.includes(id) ?? false
    }))
  const open = (group: GroupState) => {
    const onChange = vi.fn<() => void>()
    openGroupPopover(document.body.createEl('button'), {
      fields: [
        { id: 'status', label: 'Status' },
        { id: 'priority', label: 'Priority' }
      ],
      group,
      field: () => group.field,
      columns: () => columns(group),
      onChange
    })
    return onChange
  }

  it('switches the field, hides empty columns and hides one by its eye', () => {
    const group: GroupState = { field: 'status' }
    const onChange = open(group)
    const row = document.body.findAll('.llk-vis-row')
    expect(row.map((r) => r.find('.llk-vis-detail')?.textContent)).toEqual(['1', '1', 'empty'])
    row[1].querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(group.columns?.status?.hidden).toEqual(['doing'])
    document.body.querySelector<HTMLInputElement>('.llk-group-pop input[type=checkbox]')?.click()
    expect(group.hideEmpty).toBe(true)
    const field = document.body.querySelector<HTMLSelectElement>('select.llk-group-field')
    if (!field) throw new Error('no field picker')
    field.value = 'priority'
    field.dispatchEvent(new Event('change'))
    expect(group.field).toBe('priority')
    expect(group.columns?.status?.hidden).toEqual(['doing'])
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('shows every hidden column again and reorders by dragging', () => {
    const group: GroupState = { field: 'status', columns: { status: { hidden: ['todo'] } } }
    open(group)
    document.body.querySelector<HTMLButtonElement>('.llk-group-pop .llk-pop-head-action')?.click()
    expect(group.columns?.status?.hidden).toBeUndefined()
    const rows = document.body.findAll('.llk-vis-row')
    rows[2].dispatchEvent(new Event('dragstart'))
    rows[0].dispatchEvent(new Event('drop'))
    expect(group.columns?.status?.order).toEqual(['done', 'todo', 'doing'])
  })
})

describe('fields popover', () => {
  const catalog = { customFields: [{ id: 'client', name: 'Client', type: 'text' as const }], multi: false }
  const open = (fields: ViewFields) => {
    const onChange = vi.fn<() => void>()
    openFieldsPopover(document.body.createEl('button'), { fields, catalog, onChange })
    return onChange
  }
  const labels = (): (string | undefined)[] =>
    document.body
      .findAll('.llk-fields-body > .llk-vis-list:first-child .llk-vis-label')
      .map((el) => el.textContent ?? '')

  it('lists board card fields without mode tabs or column widths', () => {
    open({})
    expect(labels()).toEqual(['Priority', 'Time', 'Tags', 'Progress', 'Assignees', 'Due'])
    expect(document.body.find('.llk-fields-tabs')).toBeNull()
    expect(document.body.find('.llk-vis-detail')).toBeNull()
    expect(document.body.find('.llk-vis-lock')).toBeNull()
    expect(document.body.findAll('.llk-fields-foot button').map((button) => button.textContent)).toEqual(['Hide all'])
  })

  it('hides a field by its eye and shows it again in its place', () => {
    const fields: ViewFields = {}
    const onChange = open(fields)
    document.body.find('.llk-vis-row[data-id="time"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(fields.kanban?.visible).not.toContain('time')
    expect(document.body.find('.llk-fields-pop .llk-pop-head.llk-pop-section')).not.toBeNull()
    document.body
      .find('.llk-vis-row.is-hidden[data-id="time"]')
      ?.querySelector<HTMLButtonElement>('.llk-vis-eye')
      ?.click()
    expect(fields.kanban).toBeUndefined()
    expect(labels()).toEqual(['Priority', 'Time', 'Tags', 'Progress', 'Assignees', 'Due'])
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('forgets a list put back to the defaults', () => {
    const fields: ViewFields = { kanban: { visible: ['priority', 'time', 'tags', 'progress', 'assignees'] } }
    open(fields)
    const due = document.body.findAll('.llk-vis-row.is-hidden').find((row) => row.dataset.id === 'due')
    due?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(fields.kanban).toBeUndefined()
  })

  it('reorders board fields by dragging and hides every optional field', () => {
    const fields: ViewFields = { kanban: { visible: ['priority', 'time', 'due'] } }
    open(fields)
    const rows = document.body.findAll('.llk-vis-row')
    rows[2].dispatchEvent(new Event('dragstart'))
    rows[0].dispatchEvent(new Event('drop'))
    expect(fields.kanban?.visible).toEqual(['due', 'priority', 'time'])
    document.body.querySelector<HTMLButtonElement>('.llk-fields-foot button')?.click()
    expect(fields.kanban?.visible).toEqual([])
    expect(labels()).toEqual([])
    expect(document.body.querySelector<HTMLButtonElement>('.llk-fields-foot button')?.disabled).toBe(true)
  })

  it('offers descriptions, subtasks and custom fields as hidden board fields', () => {
    const fields: ViewFields = {}
    const onChange = open(fields)
    expect(document.body.findAll('.llk-vis-row.is-hidden').map((row) => row.dataset.id)).toEqual([
      'description',
      'subtasks',
      'cf:client'
    ])
    document.body.find('.llk-vis-row[data-id="cf:client"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(fields.kanban?.visible.at(-1)).toBe('cf:client')
    expect(labels().at(-1)).toBe('Client')
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('project filter popover', () => {
  it('checks progress stages and tags, then clears them', () => {
    const filter: ProjectListFilter = {}
    const onChange = vi.fn<() => void>()
    openProjectFilterPopover(document.body.createEl('button'), {
      filter,
      progress: { 'not-started': 2, 'in-progress': 5, complete: 1 },
      tags: [{ tag: 'client', count: 3 }],
      onChange
    })
    const rows = (): HTMLElement[] => document.body.findAll('.llk-project-filter .llk-pop-item')
    expect(rows().map((row) => row.find('.llk-pop-item-note')?.textContent)).toEqual(['2', '5', '1', '3'])
    rows()[2].click()
    rows()[3].click()
    expect(filter).toEqual({ progress: ['complete'], tags: ['client'] })
    rows()[3].click()
    expect(filter).toEqual({ progress: ['complete'] })
    document.body.find('.llk-project-filter .llk-chip-btn')?.click()
    expect(filter).toEqual({})
    expect(onChange).toHaveBeenCalledTimes(4)
  })

  it('leaves Clear all out for a host that has its own', () => {
    renderProjectFilterPanel(document.body.createDiv(), {
      filter: { progress: ['complete'] },
      progress: { 'not-started': 2, 'in-progress': 5, complete: 1 },
      tags: [],
      onChange: noop,
      showClear: false
    })
    expect(document.body.find('.llk-project-filter .llk-pop-head-action')).toBeNull()
  })
})

describe('project fields popover', () => {
  const ids = (selector: string): (string | undefined)[] => document.body.findAll(selector).map((row) => row.dataset.id)

  it('hides, shows and puts back the columns, with the title locked first', () => {
    const onChange = vi.fn<(shown: ProjectListField[]) => void>()
    openProjectFieldsPopover(document.body.createEl('button'), { shown: ['progress', 'tasks', 'due'], onChange })
    expect(ids('.llk-vis-row:not(.is-hidden)')).toEqual(['project', 'progress', 'tasks', 'due'])
    expect(ids('.llk-vis-row.is-hidden')).toEqual(['members'])
    expect(document.body.find('.llk-vis-row')?.find('.llk-vis-eye')).toBeNull()

    document.body.find('.llk-vis-row[data-id="tasks"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(onChange).toHaveBeenLastCalledWith(['progress', 'due'])
    document.body.find('.llk-vis-row[data-id="members"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(onChange).toHaveBeenLastCalledWith(['progress', 'members', 'due'])
    document.body.find('.llk-vis-row[data-id="tasks"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    expect(onChange).toHaveBeenLastCalledWith(['progress', 'tasks', 'members', 'due'])
    expect(document.body.querySelector<HTMLButtonElement>('.llk-fields-foot .llk-chip-btn')?.disabled).toBe(true)

    document.body.find('.llk-vis-row[data-id="due"]')?.querySelector<HTMLButtonElement>('.llk-vis-eye')?.click()
    document.body.find('.llk-fields-foot .llk-chip-btn')?.click()
    expect(onChange).toHaveBeenLastCalledWith(['progress', 'tasks', 'members', 'due'])
  })
})

describe('breadcrumb', () => {
  it('opens ancestors and the project switcher without a view-mode control', () => {
    const onOpen = vi.fn<(newTab: boolean) => void>()
    const onSwitch = vi.fn<(anchor: HTMLElement) => void>()
    const nav = renderBreadcrumb(document.body, {
      ancestors: [{ title: 'Acme', onOpen }],
      title: 'Website',
      onSwitch,
      foldLabel: 'Parent projects'
    })
    nav
      .querySelector<HTMLButtonElement>('.llk-crumb--ancestor')
      ?.dispatchEvent(new MouseEvent('click', { ctrlKey: true }))
    expect(onOpen).toHaveBeenCalledWith(true)
    nav.querySelector<HTMLButtonElement>('.llk-crumb--current')?.click()
    expect(onSwitch).toHaveBeenCalled()
    expect(nav.find('.llk-crumb--mode')).toBeNull()
    expect(nav.find('.llk-crumb-mode-sep')).toBeNull()
  })

  it('lists the folded ancestors in a menu', () => {
    const onOpen = vi.fn<(newTab: boolean) => void>()
    const nav = renderBreadcrumb(document.body, {
      ancestors: [
        { title: 'Clients', onOpen: noop },
        { title: 'Acme', onOpen }
      ],
      title: 'Website',
      foldLabel: 'Parent projects'
    })
    nav.querySelector<HTMLButtonElement>('.llk-crumb-fold')?.click()
    expect(menuTitles()).toEqual(['Clients', 'Acme'])
    document.body.findAll('.menu .menu-item')[1].click()
    expect(onOpen).toHaveBeenCalledWith(false)
  })

  it('tints a scoped title and shows its badge', () => {
    const nav = renderBreadcrumb(document.body, {
      ancestors: [],
      title: 'Website, Shop',
      badge: '+1',
      scoped: true,
      foldLabel: ''
    })
    const current = nav.find('.llk-crumb--current')
    expect(current?.hasClass('llk-crumb--scoped')).toBe(true)
    expect(current?.find('.llk-crumb-badge')?.textContent).toBe('+1')
  })

  it('leaves a title without a switcher inert', () => {
    const nav = renderBreadcrumb(document.body, { ancestors: [], title: 'All projects', foldLabel: '' })
    expect(nav.querySelector<HTMLButtonElement>('.llk-crumb--current')?.disabled).toBe(true)
    expect(nav.find('.llk-crumb-fold')).toBeNull()
  })
})

describe('SearchBox', () => {
  it('clears on the first Escape and closes on the second', () => {
    const onChange = vi.fn<(value: string) => void>()
    const box = new SearchBox(document.body, {
      value: 'checkout',
      label: 'Search',
      placeholder: 'Search tasks',
      clearLabel: 'Clear',
      onChange
    })
    expect(box.el.hasClass('is-open')).toBe(true)
    const input = box.el.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('no input')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onChange).toHaveBeenCalledWith('')
    expect(input.value).toBe('')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(box.el.hasClass('is-open')).toBe(false)
  })

  it('shows a query set elsewhere without reporting it back', () => {
    const onChange = vi.fn<(value: string) => void>()
    const box = new SearchBox(document.body, { value: '', label: 'Search', placeholder: '', clearLabel: '', onChange })
    box.setValue('copy')
    expect(box.el.querySelector<HTMLInputElement>('input')?.value).toBe('copy')
    expect(box.el.hasClass('is-open')).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens in a popover with the field focused', () => {
    openSearchPopover(document.body.createDiv(), {
      value: 'copy',
      label: 'Search',
      placeholder: '',
      clearLabel: '',
      onChange: noop
    })
    const input = document.body.querySelector<HTMLInputElement>('.llk-pop .llk-search-box-input')
    expect(input?.value).toBe('copy')
    expect(document.activeElement).toBe(input)
  })
})

describe('ViewHeader', () => {
  const LEVELS = ['llk-vh--icons', 'llk-vh--tuned', 'llk-vh--folded', 'llk-vh--tight', 'llk-vh--terse', 'llk-vh--bare']

  /** A header whose row fits once `fitsAt` is applied. */
  function mountHeader(fitsAt: string): ViewHeader {
    const header = new ViewHeader(document.body)
    const row = header.el.find('.llk-vh-row')
    if (!row) throw new Error('no row')
    Object.defineProperty(row, 'clientWidth', { value: 400 })
    Object.defineProperty(row, 'scrollWidth', { get: () => (header.el.hasClass(fitsAt) ? 380 : 600) })
    return header
  }

  const applied = (header: ViewHeader): string[] => LEVELS.filter((level) => header.el.hasClass(level))

  it('steps through the compact levels until the row fits', () => {
    const header = mountHeader('llk-vh--folded').setTuneItems(() => [])
    header.fit()
    expect(applied(header)).toEqual(['llk-vh--icons', 'llk-vh--tuned', 'llk-vh--folded'])
    expect(header.el.hasClass('llk-vh--measuring')).toBe(false)
    header.destroy()
  })

  it('skips folding into Tune when the view gives it nothing to list', () => {
    const header = mountHeader('llk-vh--folded')
    header.fit()
    expect(applied(header)).toEqual(['llk-vh--icons', 'llk-vh--folded'])
    header.destroy()
  })

  it('stays at full labels when everything fits', () => {
    const header = new ViewHeader(document.body)
    header.fit()
    expect(header.el.hasClass('llk-vh--icons')).toBe(false)
    header.destroy()
  })

  it('lists the controls with their state and opens the one picked from the Tune button', () => {
    const onOpen = vi.fn<(anchor: HTMLElement) => void>()
    const control = vi.fn<(parent: HTMLElement) => void>()
    const items: TuneItem[][] = [
      [
        { icon: 'list-filter', label: 'Filter', state: '5', onOpen },
        { icon: 'arrow-down-up', label: 'Sort', state: 'Priority +1', onOpen: noop }
      ],
      [{ icon: 'columns-3', label: 'Group', control }]
    ]
    const header = new ViewHeader(document.body).setTuneItems(() => items)
    header.tune.el.click()
    const rows = document.body.findAll('.llk-tune-pop .llk-pop-item')
    expect(
      rows.map((row) => [row.find('.llk-pop-item-label')?.textContent, row.find('.llk-pop-item-note')?.textContent])
    ).toEqual([
      ['Filter', '5'],
      ['Sort', 'Priority +1']
    ])
    expect(document.body.findAll('.llk-tune-pop .llk-pop-list').length).toBe(2)
    expect(control).toHaveBeenCalledWith(document.body.find('.llk-tune-row'))
    rows[0].click()
    expect(onOpen).toHaveBeenCalledWith(header.tune.el)
    expect(document.body.find('.llk-tune-pop')).toBeNull()
    header.destroy()
  })
})

describe('tune sheet', () => {
  function sheetProps(state: { filters: number; shown: number }): TuneSheetProps {
    return {
      tabs: [
        {
          id: 'filter',
          label: 'Filter',
          badge: () => (state.filters ? String(state.filters) : ''),
          render: (parent, changed) => {
            const add = parent.createEl('button', { cls: 'add-filter', text: 'Add' })
            add.addEventListener('click', () => {
              state.filters++
              state.shown -= 10
              changed()
            })
          }
        },
        { id: 'sort', label: 'Sort', render: (parent) => parent.createDiv({ cls: 'sort-panel' }) }
      ],
      clear: {
        label: 'Clear all',
        canClear: () => state.filters > 0,
        onClear: () => {
          state.filters = 0
          state.shown = 42
        }
      },
      doneLabel: () => `Show ${state.shown} tasks`
    }
  }

  const done = (): string | null | undefined => document.body.find('.llk-tune-sheet-done')?.textContent
  const clear = (): HTMLElement | null => document.body.find('.llk-tune-sheet-clear')

  it('follows each edit in the tab badge, Clear all and the closing button', () => {
    const state = { filters: 0, shown: 42 }
    openTuneSheet(document.body.createDiv(), sheetProps(state))
    expect(done()).toBe('Show 42 tasks')
    expect(clear()?.hasClass('llk-hidden')).toBe(true)
    document.body.find('.add-filter')?.click()
    expect(done()).toBe('Show 32 tasks')
    expect(document.body.find('.llk-tune-sheet-tab.llk-chip-btn--active .llk-chip-btn-badge')?.textContent).toBe('1')
    expect(clear()?.hasClass('llk-hidden')).toBe(false)
    clear()?.click()
    expect(done()).toBe('Show 42 tasks')
    expect(clear()?.hasClass('llk-hidden')).toBe(true)
  })

  it('switches panels by tab and closes from its button', () => {
    openTuneSheet(document.body.createDiv(), sheetProps({ filters: 0, shown: 42 }))
    document.body.findAll('.llk-tune-sheet-tab')[1].click()
    expect(document.body.find('.sort-panel')).not.toBeNull()
    expect(document.body.find('.add-filter')).toBeNull()
    expect(document.body.find('.llk-tune-sheet-tab.llk-chip-btn--active')?.getAttribute('aria-selected')).toBe('true')
    document.body.find('.llk-tune-sheet-done')?.click()
    expect(document.body.find('.llk-tune-sheet')).toBeNull()
  })
})

describe('ViewHeader on a phone', () => {
  afterEach(() => setPlatform(domPlatform))

  it('lays out as two rows without measuring, and opens the sheet and the More menu', () => {
    setPlatform({ ...domPlatform, isPhone: () => true })
    const sheet = vi.fn<() => TuneSheetProps>(() => ({ tabs: [], doneLabel: () => 'Show 3 tasks' }))
    const build = vi.fn<(menu: unknown, anchor: HTMLElement) => void>()
    const header = new ViewHeader(document.body)
      .setTuneItems(() => [])
      .setTuneSheet(sheet)
      .setMoreMenu(build)
    header.fit()
    expect(header.el.hasClass('llk-vh--phone')).toBe(true)
    expect(header.el.hasClass('llk-vh--icons')).toBe(false)
    header.tune.el.click()
    expect(sheet).toHaveBeenCalled()
    expect(document.body.find('.llk-pop--sheet .llk-tune-sheet')).not.toBeNull()
    header.el.find('.llk-vh-more button')?.click()
    expect(build).toHaveBeenCalledWith(expect.anything(), header.el.find('.llk-vh-more button'))
    header.destroy()
  })

  it('has no More button off a phone', () => {
    const header = new ViewHeader(document.body).setMoreMenu(noop)
    expect(header.el.find('.llk-vh-more')).toBeNull()
    header.destroy()
  })
})

describe('project switcher', () => {
  const projects: SwitcherProject[] = [
    { path: 'acme', title: 'Acme', folder: 'Clients', taskCount: 4 },
    { path: 'web', title: 'Website', parent: 'acme', folder: 'Clients', taskCount: 10 },
    { path: 'shop', title: 'Shop', parent: 'acme', folder: 'Clients', taskCount: 5 },
    { path: 'ops', title: 'Ops', folder: 'Internal', taskCount: 2 }
  ]
  const open = (props: Partial<ProjectSwitcherProps> = {}): ProjectSwitcherProps => {
    const full: ProjectSwitcherProps = {
      projects,
      selected: ['web'],
      current: 'web',
      presets: [],
      onPick: noop,
      onShow: noop,
      ...props
    }
    openProjectSwitcher(document.body.createEl('button'), full)
    return full
  }
  const line = (path: string): HTMLElement => {
    const el = document.body.find(`.llk-switcher-line[data-path="${path}"]`)
    if (!el) throw new Error(`no row for ${path}`)
    return el
  }
  const box = (path: string): HTMLInputElement => line(path).find('input') as HTMLInputElement
  const tick = (path: string): void => {
    box(path).checked = !box(path).checked
    box(path).dispatchEvent(new Event('change'))
  }
  const rowTitles = (): string[] =>
    document.body.findAll('.llk-switcher-row .llk-pop-item-label').map((el) => el.textContent ?? '')
  const outside = (): void => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  }

  it('lists projects under their folders, opening the branch holding the selection', () => {
    open()
    expect(document.body.findAll('.llk-switcher-list .llk-pop-heading').map((el) => el.textContent)).toEqual([
      'Clients',
      'Internal'
    ])
    expect(rowTitles()).toEqual(['Acme', 'Website', 'Shop', 'Ops'])
    expect(box('web').checked).toBe(true)
    expect(box('acme').indeterminate).toBe(true)
    expect(line('web').find('.llk-pop-check--hidden')).toBeNull()
  })

  it('keeps a branch without a selection closed, counting what it hides', () => {
    open({ selected: ['ops'], current: 'ops' })
    expect(rowTitles()).toEqual(['Acme', 'Ops'])
    expect(line('acme').find('.llk-pop-item-note')?.textContent).toBe('+2')
    line('acme').find('.llk-collapse-toggle')?.click()
    expect(rowTitles()).toEqual(['Acme', 'Website', 'Shop', 'Ops'])
  })

  it('checks a whole branch from its parent and applies the selection on close', () => {
    const onShow = vi.fn<(paths: string[]) => void>()
    open({ onShow })
    tick('acme')
    expect(['acme', 'web', 'shop'].map((path) => box(path).checked)).toEqual([true, true, true])
    expect(document.body.find('.llk-switcher-summary')?.textContent).toBe('3 selected · 19 tasks')
    outside()
    expect(onShow).toHaveBeenCalledExactlyOnceWith(['web', 'acme', 'shop'])
  })

  it('applies from its button and discards the selection on Escape', () => {
    const onShow = vi.fn<(paths: string[]) => void>()
    open({ onShow })
    tick('ops')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onShow).not.toHaveBeenCalled()
    open({ onShow })
    tick('ops')
    const show = document.body.find('.llk-switcher-foot button.mod-cta') as HTMLButtonElement
    expect(show.textContent).toBe('Show 2 projects')
    show.click()
    expect(onShow).toHaveBeenCalledExactlyOnceWith(['web', 'ops'])
  })

  it('reports nothing when the selection is unchanged or cleared', () => {
    const onShow = vi.fn<(paths: string[]) => void>()
    open({ onShow })
    outside()
    open({ onShow })
    ;(document.body.find('.llk-switcher-foot .llk-chip-btn') as HTMLButtonElement).click()
    expect(box('web').checked).toBe(false)
    expect((document.body.find('.llk-switcher-foot button.mod-cta') as HTMLButtonElement).disabled).toBe(true)
    outside()
    expect(onShow).not.toHaveBeenCalled()
  })

  it('goes to a project alone on a click and toggles it on a modifier-click or Space', () => {
    const onPick = vi.fn<(path: string) => void>()
    const onShow = vi.fn<(paths: string[]) => void>()
    open({ onPick, onShow })
    const row = (path: string): HTMLButtonElement => line(path).find('.llk-switcher-row') as HTMLButtonElement
    row('shop').dispatchEvent(new MouseEvent('click', { ctrlKey: true }))
    expect(box('shop').checked).toBe(true)
    row('ops').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(box('ops').checked).toBe(true)
    row('ops').click()
    expect(onPick).toHaveBeenCalledExactlyOnceWith('ops')
    expect(onShow).not.toHaveBeenCalled()
  })

  it('runs a preset instead of the selection', () => {
    const onPick = vi.fn<() => void>()
    const onShow = vi.fn<(paths: string[]) => void>()
    open({ onShow, presets: [{ label: 'All projects', active: false, onPick }] })
    tick('ops')
    ;(document.body.find('.llk-switcher-presets .llk-chip-btn') as HTMLButtonElement).click()
    expect(onPick).toHaveBeenCalledOnce()
    expect(onShow).not.toHaveBeenCalled()
  })

  it('searches titles and folders as a flat list', () => {
    open()
    const search = document.body.find('input.llk-pop-field') as HTMLInputElement
    search.value = 'internal'
    search.dispatchEvent(new Event('input'))
    expect(rowTitles()).toEqual(['Ops'])
    search.value = 'shop'
    search.dispatchEvent(new Event('input'))
    expect(rowTitles()).toEqual(['Shop'])
    expect(document.body.find('.llk-switcher-list .llk-collapse-toggle')).toBeNull()
  })
})
