import type { App } from 'obsidian'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, findTaskById, parseFrontmatter } from '@low-level-kanban/core'
import { makeFakeApp } from '#test/fakeVault'
import { ProjectStore } from './ProjectStore'
import { VaultIndex } from './VaultIndex'

const PROJECT_PATH = 'Projects/Roadmap/Roadmap.md'
const TASK_PATH = 'Projects/Roadmap/_tasks/parent.md'
const CHILD_PATH = 'Projects/Roadmap/_tasks/child.md'

function note(marker: string, properties: string, body: string): string {
  return `---\n${marker}: true\n${properties}\nforeign:\n  source: another-plugin\n---\n\n${body}\n`
}

function parsedNote(content: string | null) {
  const parsed = parseFrontmatter(content ?? '')
  if (parsed.kind !== 'frontmatter') throw new Error('expected frontmatter')
  return parsed
}

describe.each([false, true])('brand compatibility with metadata cache %s', (liveMetadataCache) => {
  it.each([
    ['pm-project', 'pm-task'],
    ['low-level-kanban-project', 'low-level-kanban-task'],
    ['pm-project', 'low-level-kanban-task'],
    ['low-level-kanban-project', 'pm-task']
  ])('hydrates %s and %s without writes, then saves only new markers', async (projectMarker, taskMarker) => {
    const { app, vault } = makeFakeApp({ liveMetadataCache })
    const typed = app as unknown as App
    const settings = { ...DEFAULT_SETTINGS, autoSchedule: false }
    await vault.create(
      PROJECT_PATH,
      note(projectMarker, 'id: p1\ntitle: Roadmap\ntaskIds: ["[[parent]]"]', '# Roadmap\n\nProject body')
    )
    await vault.create(
      TASK_PATH,
      note(taskMarker, 'id: t1\ntitle: Parent\nprojectId: "[[Roadmap]]"\nsubtaskIds: ["[[child]]"]', 'Parent body')
    )
    await vault.create(
      CHILD_PATH,
      note(
        taskMarker,
        'id: t2\ntitle: Child\nprojectId: "[[Roadmap]]"\nparentId: "[[parent]]"\ndependencies: ["[[parent]]"]',
        'Child body'
      )
    )
    const childBefore = vault.contentAt(CHILD_PATH)
    vault.resetCounts()
    const index = new VaultIndex(typed, () => settings)
    index.build()
    expect(index.projectRef(PROJECT_PATH)?.id).toBe(liveMetadataCache ? 'p1' : undefined)
    expect(index.task('t2')?.dependencies).toEqual(liveMetadataCache ? ['t1'] : undefined)
    expect(index.task('t2')?.path).toBe(liveMetadataCache ? CHILD_PATH : undefined)
    expect(index.task('t2')?.projectPath).toBe(liveMetadataCache ? PROJECT_PATH : undefined)
    expect(index.taskRefs(PROJECT_PATH)).toHaveLength(liveMetadataCache ? 2 : 0)
    const store = new ProjectStore(typed, () => settings, index)
    const project = await store.loadProjectByPath(PROJECT_PATH)
    if (!project) throw new Error('expected project')
    const parent = findTaskById(project, 't1')
    const child = findTaskById(project, 't2')
    if (!parent || !child) throw new Error('expected task tree')
    await store.loadProjectBody(project)
    await store.loadTaskBody(parent)
    await store.loadTaskBody(child)
    expect(project).toMatchObject({ id: 'p1', filePath: PROJECT_PATH, description: 'Project body' })
    expect(parent).toMatchObject({ id: 't1', filePath: TASK_PATH, description: 'Parent body', subtasks: [child] })
    expect(child).toMatchObject({ id: 't2', filePath: CHILD_PATH, description: 'Child body', dependencies: ['t1'] })
    expect(vault.modifyCount.size).toBe(0)
    expect(vault.createCount.size).toBe(0)

    // A metadata-only task save replaces its marker without touching its body or sibling.
    await store.updateTask(project, parent.id, { priority: 'high' })
    const savedProject = parsedNote(vault.contentAt(PROJECT_PATH))
    const savedTask = parsedNote(vault.contentAt(TASK_PATH))
    expect(savedProject.frontmatter).toMatchObject({
      'low-level-kanban-project': true,
      id: 'p1',
      foreign: { source: 'another-plugin' }
    })
    expect(savedProject.frontmatter).not.toHaveProperty('pm-project')
    expect(savedTask.frontmatter).toMatchObject({
      'low-level-kanban-task': true,
      id: 't1',
      priority: 'high',
      foreign: { source: 'another-plugin' }
    })
    expect(savedTask.frontmatter).not.toHaveProperty('pm-task')
    expect(savedTask.body).toBe('Parent body')
    expect(savedProject.body).toContain('Project body')
    expect(vault.contentAt(CHILD_PATH)).toBe(childBefore)
    expect(vault.createCount.size).toBe(0)
    expect(vault.trashCount.size).toBe(0)

    // A body save also drops legacy keys, keeping relations and foreign properties.
    await store.updateTask(project, child.id, { description: 'Child body updated' })
    const savedChild = parsedNote(vault.contentAt(CHILD_PATH))
    expect(savedChild.frontmatter).toMatchObject({
      'low-level-kanban-task': true,
      id: 't2',
      foreign: { source: 'another-plugin' }
    })
    expect(savedChild.frontmatter).not.toHaveProperty('pm-task')
    expect(savedChild.body).toContain('Child body updated')
    const reloaded = await new ProjectStore(typed, () => settings, index).loadProjectByPath(PROJECT_PATH)
    if (!reloaded) throw new Error('expected reloaded project')
    expect(findTaskById(reloaded, 't1')?.subtasks[0].id).toBe('t2')
    expect(findTaskById(reloaded, 't2')?.dependencies).toEqual(['t1'])
  })
})

describe('marker conflicts and imports', () => {
  it('indexes a new marker as authoritative and removes both owned keys on save', async () => {
    const { app, vault } = makeFakeApp({ liveMetadataCache: true })
    const typed = app as unknown as App
    await vault.create(
      PROJECT_PATH,
      note('low-level-kanban-project', 'pm-project: false\nid: p1\ntitle: Roadmap', 'Body')
    )
    await vault.create(TASK_PATH, note('low-level-kanban-task', 'pm-task: false\nid: t1\ntitle: Parent', 'Body'))
    await vault.create('Not a project.md', note('pm-project', 'low-level-kanban-project: false\nid: excluded', 'Body'))
    await vault.create('Not a task.md', note('pm-task', 'low-level-kanban-task: false\nid: excluded', 'Body'))
    const index = new VaultIndex(typed, () => DEFAULT_SETTINGS)
    index.build()
    expect(index.projectPaths()).toEqual([PROJECT_PATH])
    expect(index.allTaskRefs().map((task) => task.id)).toEqual(['t1'])
    const store = new ProjectStore(typed, () => ({ ...DEFAULT_SETTINGS, autoSchedule: false }), index)
    const project = await store.loadProjectByPath(PROJECT_PATH)
    if (!project) throw new Error('expected project')
    await store.updateTask(project, 't1', { priority: 'high' })
    expect(parsedNote(vault.contentAt(PROJECT_PATH)).frontmatter).not.toHaveProperty('pm-project')
    expect(parsedNote(vault.contentAt(TASK_PATH)).frontmatter).not.toHaveProperty('pm-task')
  })

  it.each(['pm-task', 'low-level-kanban-task'])('does not import an existing %s note again', async (marker) => {
    const { app, vault } = makeFakeApp()
    const store = new ProjectStore(app as unknown as App)
    const project = await store.createProject('Roadmap', 'Projects')
    const file = await vault.create('Inbox/Existing.md', note(marker, 'id: t1\ntitle: Existing', 'Body'))
    vault.resetCounts()
    expect(await store.importNoteAsTask(project, file, { handling: 'move', status: 'todo', priority: 'low' })).toBe(
      'skipped'
    )
    expect(file.path).toBe('Inbox/Existing.md')
    expect(vault.modifyCount.size).toBe(0)
    expect(vault.createCount.size).toBe(0)
  })
})
