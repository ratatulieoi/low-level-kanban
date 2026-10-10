import { Menu, Notice } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import { type Task, type Project, appendBodyChecklist, checklistProgress, t } from '@low-level-kanban/core'
import { safeAsync } from '@low-level-kanban/ui'
import { openTaskModal, confirmDialog, confirmDuplicateSubtasks, openProjectPicker, promptText } from './ModalFactory'

export interface TaskMenuContext {
  plugin: LowLevelKanbanPlugin
  project: Project
  onRefresh: () => Promise<void>
}

export function buildTaskContextMenu(menu: Menu, task: Task, ctx: TaskMenuContext): Menu {
  menu.addItem((item) =>
    item
      .setTitle(t('taskMenu.edit'))
      .setIcon('pencil')
      .onClick(() => {
        openTaskModal(ctx.plugin, ctx.project, {
          task,
          onSave: async () => {
            await ctx.onRefresh()
          }
        })
      })
  )
  menu.addItem((item) =>
    item
      .setTitle(t('taskMenu.addSubtask'))
      .setIcon('plus')
      .onClick(
        safeAsync(async () => {
          const title = await promptText(ctx.plugin.app, t('taskMenu.addSubtask'), t('subtasks.addPlaceholder'))
          if (!title) return
          const updatedDescription = appendBodyChecklist(task.description, title)
          const progress = checklistProgress(updatedDescription)
          await ctx.plugin.store.updateTask(ctx.project, task.id, {
            description: updatedDescription,
            progress
          })
          await ctx.onRefresh()
        })
      )
  )
  menu.addItem((item) =>
    item
      .setTitle(t('taskMenu.duplicate'))
      .setIcon('copy')
      .onClick(
        safeAsync(async () => {
          let includeSubtasks = false
          if (task.subtasks.length > 0) {
            const choice = await confirmDuplicateSubtasks(ctx.plugin.app, task.title)
            if (choice === null) return
            includeSubtasks = choice === 'with-subtasks'
          }
          await ctx.plugin.store.duplicateTask(ctx.project, task.id, includeSubtasks)
          await ctx.onRefresh()
        })
      )
  )
  menu.addItem((item) =>
    item
      .setTitle(t('taskMenu.moveToProject'))
      .setIcon('folder-input')
      .onClick(() => {
        const targets = ctx.plugin.index.projectRefs().filter((ref) => ref.path !== ctx.project.filePath)
        if (!targets.length) {
          new Notice(t('taskMenu.noOtherProject'))
          return
        }
        openProjectPicker(
          ctx.plugin,
          targets,
          safeAsync(async (ref) => {
            const target = await ctx.plugin.store.loadProjectByPath(ref.path)
            if (!target) return
            await ctx.plugin.store.moveTaskToProject(ctx.project, target, task.id)
            new Notice(t('taskMenu.moved', { title: task.title, project: target.title }))
            await ctx.onRefresh()
          })
        )
      })
  )
  menu.addSeparator()
  if (task.archived) {
    menu.addItem((item) =>
      item
        .setTitle(t('common.unarchive'))
        .setIcon('archive-restore')
        .onClick(
          safeAsync(async () => {
            await ctx.plugin.store.unarchiveTask(ctx.project, task.id)
            new Notice(t('task.unarchived'))
            await ctx.onRefresh()
          })
        )
    )
  } else {
    menu.addItem((item) =>
      item
        .setTitle(t('common.archive'))
        .setIcon('archive')
        .onClick(
          safeAsync(async () => {
            await ctx.plugin.store.archiveTask(ctx.project, task.id)
            new Notice(t('task.archived'))
            await ctx.onRefresh()
          })
        )
    )
  }
  menu.addItem((item) =>
    item
      .setTitle(t('taskMenu.delete'))
      .setIcon('trash')
      .onClick(
        safeAsync(async () => {
          if (await confirmDialog(ctx.plugin.app, t('task.deleteConfirm', { title: task.title }))) {
            await ctx.plugin.store.deleteTask(ctx.project, task.id)
            await ctx.onRefresh()
          }
        })
      )
  )
  return menu
}
