// @vitest-environment happy-dom
import type { WorkspaceLeaf } from 'obsidian'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, makeProject, makeTask, resolveProjectConfig, t, type Project } from '@dotpm/core'
import type PMPlugin from '#main'
import { openTaskModal } from '#ui/ModalFactory'
import { ProjectOverviewView } from './ProjectOverviewView'

vi.mock('obsidian', async (importOriginal) => ({
  ...(await importOriginal()),
  ItemView: vi.fn<() => void>(),
  Component: vi.fn<() => void>()
}))
vi.mock('#ui/ModalFactory', () => ({ openTaskModal: vi.fn() }))

const config = resolveProjectConfig(makeProject('Release', 'Projects/Release.md'), DEFAULT_SETTINGS)

describe('ProjectOverviewView milestones', () => {
  let plugin: PMPlugin
  let project: Project
  let view: ProjectOverviewView
  let host: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.empty()
    host = document.body.createDiv()
    plugin = {} as PMPlugin
    project = makeProject('Release', 'Projects/Release.md')
    view = new ProjectOverviewView({} as WorkspaceLeaf, plugin)
    view['project'] = project
  })

  it('lists milestones by date, includes undated milestones, and leaves tasks unchanged', () => {
    const undated = makeTask({ id: 'undated', title: 'Later', type: 'milestone' })
    const later = makeTask({ id: 'later', title: 'Launch', type: 'milestone', due: '2030-04-20' })
    const earlier = makeTask({ id: 'earlier', title: 'Ready', type: 'milestone', due: '2030-04-01', status: 'done' })
    const task = makeTask({ id: 'task', title: 'Ordinary task' })
    const tasks = [undated, later, earlier, task]
    const original = structuredClone(tasks)

    view['renderMilestones'](host, tasks, config)

    expect(host.findAll('.pm-overview-child-title').map((el) => el.textContent)).toEqual(['Ready', 'Launch', 'Later'])
    expect(host.find('.pm-overview-note')?.textContent).toBe(t('overview.milestonesDone', { done: 1, total: 3 }))
    expect(host.textContent).toContain(config.statuses.find((status) => status.id === 'done')!.label)
    expect(host.findAll('.pm-overview-child')).toHaveLength(3)
    expect(host.find('.pm-timeline')).toBeNull()
    expect(tasks).toEqual(original)
  })

  it('opens the existing task editor from a milestone title or row', () => {
    const task = makeTask({ id: 'launch', title: 'Launch', type: 'milestone', due: '2030-04-20' })
    view['renderMilestones'](host, [task], config)

    host.find('.pm-overview-child-title')!.click()
    expect(openTaskModal).toHaveBeenCalledWith(plugin, project, { task, onSave: expect.any(Function) })
    host.find('.pm-overview-child')!.click()
    expect(openTaskModal).toHaveBeenCalledTimes(2)
  })

  it('keeps the milestone empty state', () => {
    view['renderMilestones'](host, [makeTask({ title: 'Ordinary task' })], config)

    expect(host.textContent).toContain(t('overview.noMilestones'))
    expect(host.findAll('.pm-overview-child')).toHaveLength(0)
  })
})
