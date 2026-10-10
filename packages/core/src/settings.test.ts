import { describe, expect, it } from 'vitest'
import { omitObsoleteSettings } from './settings'
import { DEFAULT_SETTINGS, makeDefaultFilter, makeDefaultGroup, makeDefaultSort } from './types'
import { legacyBoardFields } from './store/ViewFields'

const obsolete = {
  localApiEnabled: true,
  localApiPort: 27150,
  localApiToken: 'obsolete-secret-token',
  showReleaseNotes: true,
  lastSeenVersion: '2.6.0',
  ganttGranularity: 'month',
  ganttWeekLabel: 'dateRange',
  holidays: ['2026-01-01'],
  nonWorkingDays: { weekends: true }
}

describe('omitObsoleteSettings', () => {
  it('drops retired settings while preserving task settings and unknown data', () => {
    const retained = {
      ...structuredClone(DEFAULT_SETTINGS),
      projectsFolder: 'Roadmaps',
      defaultView: 'kanban',
      statuses: [{ id: 'open', label: 'Open', color: '#123456', icon: '', complete: false }],
      priorities: [{ id: 'urgent', label: 'Urgent', color: '#654321', icon: '' }],
      customFields: [{ id: 'notes', name: 'Notes', type: 'text' }],
      globalTeamMembers: ['[[People/Alex]]'],
      projectFilters: {
        'project:Roadmaps/Plan.md': {
          filter: makeDefaultFilter(),
          activeSavedViewId: null,
          sort: makeDefaultSort(),
          group: makeDefaultGroup(),
          fields: { kanban: { visible: ['assignees', 'due'] } },
          viewMode: 'kanban'
        }
      },
      collapsedTasks: { 'Roadmaps/Plan.md': ['task-1'] },
      collapsedProjects: ['Roadmaps/Plan.md'],
      unknownPreference: { keep: true }
    }
    const saved = Object.freeze({ ...retained, ...obsolete })
    const cleaned = omitObsoleteSettings(saved)

    expect(cleaned).toEqual(retained)
    expect(cleaned).not.toBe(saved)
    expect(saved).toEqual({ ...retained, ...obsolete })
    expect(JSON.stringify(cleaned)).not.toContain(obsolete.localApiToken)
  })

  it.each(Object.keys(obsolete))('removes %s even when its saved value is undefined', (key) => {
    expect(omitObsoleteSettings({ projectsFolder: 'Work', [key]: undefined })).toEqual({ projectsFolder: 'Work' })
  })

  it('removes disabled flags and empty credentials too', () => {
    expect(
      omitObsoleteSettings({
        localApiEnabled: false,
        localApiPort: 0,
        localApiToken: '',
        showReleaseNotes: false,
        lastSeenVersion: ''
      })
    ).toEqual({})
  })

  it('keeps defaults and fresh settings free of retired keys', () => {
    expect(omitObsoleteSettings({})).toEqual({})
    expect(omitObsoleteSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
    for (const key of Object.keys(obsolete)) expect(DEFAULT_SETTINGS).not.toHaveProperty(key)
  })

  it('normalizes nested legacy views without losing identity, filters, grouping or unknown settings', () => {
    const common = {
      id: 'v1',
      name: 'Sprint',
      isDefault: true,
      activeSavedViewId: 'v1',
      filter: { conditions: [{ field: 'due', op: 'bucket', value: 'overdue' }], showArchived: true },
      sort: [{ key: 'due', dir: 'desc' }],
      group: { field: 'priority', columns: { priority: { hidden: ['low'], order: ['high', 'low'] } } },
      unknownViewSetting: { keep: true }
    }
    const fields = {
      kanban: { visible: ['cf:client', 'due'] },
      table: { visible: ['title'], widths: { due: 90 } },
      gantt: { visible: ['dates'] }
    }
    const legacy = {
      ...common,
      fields,
      viewMode: 'gantt',
      ganttGranularity: 'month',
      nonWorkingDays: { weekends: true }
    }
    const saved = {
      defaultView: 'table',
      defaultFields: fields,
      projectFilters: { 'project:P.md': legacy },
      scopeViews: { vault: [legacy] },
      unknownPreference: { keep: true },
      lineBorders: 'both',
      showSubtreeConnections: false
    }
    const before = structuredClone(saved)
    const cleaned = omitObsoleteSettings(saved)
    const expected = { ...common, fields: { kanban: fields.kanban }, viewMode: 'kanban' }
    expect(cleaned).toEqual({
      defaultView: 'kanban',
      defaultFields: { kanban: fields.kanban },
      projectFilters: { 'project:P.md': expected },
      scopeViews: { vault: [expected] },
      unknownPreference: saved.unknownPreference,
      lineBorders: 'both',
      showSubtreeConnections: false
    })
    expect(omitObsoleteSettings(cleaned)).toEqual(cleaned)
    expect(saved).toEqual(before)
    expect(cleaned.defaultFields.kanban.visible).not.toBe(saved.defaultFields.kanban.visible)
  })

  it('converts ganttHideDone to status intent once, preserving an explicit status filter', () => {
    const saved = {
      ganttHideDone: true,
      statuses: [
        { id: 'open', complete: false },
        { id: 'closed', complete: true }
      ],
      projectFilters: {
        'project:Open.md': { filter: { statuses: [], tags: ['work'] } },
        'project:Closed.md': { filter: { conditions: [{ field: 'status', op: 'any', value: ['closed'] }] } }
      }
    }
    const cleaned = omitObsoleteSettings(saved)
    expect(cleaned.projectFilters['project:Open.md'].filter).toEqual({
      conditions: [
        { field: 'tag', op: 'any', value: ['work'] },
        { field: 'status', op: 'any', value: ['open'] }
      ],
      showArchived: false
    })
    expect(cleaned.projectFilters['project:Closed.md'].filter).toEqual({
      conditions: [{ field: 'status', op: 'any', value: ['closed'] }],
      showArchived: false
    })
    expect(cleaned).not.toHaveProperty('ganttHideDone')
    expect(omitObsoleteSettings(cleaned)).toEqual(cleaned)
    expect(saved.projectFilters['project:Open.md'].filter).toEqual({ statuses: [], tags: ['work'] })
  })

  it('narrows saved status entries and preserves legacy completion defaults', () => {
    const saved = {
      ganttHideDone: true,
      statuses: [
        null,
        42,
        'open',
        { id: 7 },
        { id: 'invalid', complete: 'false' },
        { id: 'open', complete: false },
        { id: 'legacy-open' },
        { id: 'legacy-unset', complete: undefined },
        { id: 'done' },
        { id: 'cancelled' },
        { id: 'closed', complete: true }
      ],
      projectFilters: { 'project:P.md': { filter: makeDefaultFilter() } }
    }
    const before = structuredClone(saved)
    const cleaned = omitObsoleteSettings(saved)
    expect(cleaned.projectFilters['project:P.md'].filter.conditions).toEqual([
      { field: 'status', op: 'any', value: ['open', 'legacy-open', 'legacy-unset'] }
    ])
    expect(saved).toEqual(before)
  })

  it('moves old board switches without replacing custom fields or their order', () => {
    const saved = {
      kanbanShowSubtasks: false,
      kanbanShowDescriptionPreview: true,
      defaultFields: { kanban: { visible: ['cf:client', 'subtasks', 'due'] } }
    }
    expect(omitObsoleteSettings(saved)).toEqual({
      defaultFields: { kanban: { visible: ['cf:client', 'due', 'description'] } }
    })
  })

  it.each([false, true])('keeps the original card order for legacy switch %s', (description) => {
    expect(omitObsoleteSettings({ kanbanShowDescriptionPreview: description })).toEqual({
      defaultFields: legacyBoardFields(false, description)
    })
  })

  it('does not mutate the shared defaults while normalizing and editing a board field list', () => {
    const before = structuredClone(DEFAULT_SETTINGS)
    const saved = { ...DEFAULT_SETTINGS, defaultFields: { kanban: { visible: ['due'] } } }
    const cleaned = omitObsoleteSettings(saved)
    cleaned.defaultFields.kanban.visible.push('description')
    expect(saved.defaultFields.kanban.visible).toEqual(['due'])
    expect(DEFAULT_SETTINGS).toEqual(before)
  })

  it('is idempotent and excludes obsolete fields if they reappear before a later save', () => {
    const loaded = omitObsoleteSettings({ projectsFolder: 'Work', ...obsolete })
    expect(omitObsoleteSettings(loaded)).toEqual(loaded)
    const persisted = JSON.parse(JSON.stringify(omitObsoleteSettings({ ...loaded, ...obsolete })))
    expect(persisted).toEqual({ projectsFolder: 'Work' })
  })
})
