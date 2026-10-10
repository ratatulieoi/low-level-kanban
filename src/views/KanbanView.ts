import { Menu } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import {
  type Task,
  type TaskType,
  type FilterContext,
  type GroupState,
  type SortRule,
  type TaskQuery,
  type ResolvedProjectConfig,
  type ViewFields,
  customFieldOf,
  shownFields,
  valueKey,
  matchesQuery,
  dueUrgency,
  getPriorityConfig,
  t,
  tn
} from '@low-level-kanban/core'
import { personKeyer, type ProjectScope } from '#store'
import {
  safeAsync,
  boardCandidates,
  boardColumns,
  boardField,
  cardCustomValues,
  ChipButton,
  descriptionPreview,
  compareTasks,
  groupValues,
  KanbanColumn,
  type BoardColumn,
  type FilterSetup,
  type KanbanCardData,
  renderProjectChip
} from '@low-level-kanban/ui'
import { openTaskModal } from '#ui/ModalFactory'
import { buildTaskContextMenu } from '#ui/TaskContextMenu'
import { linkedRefs } from './linkedRefs'
import type { SubView } from './SubView'

/**
 * `values` with the one of the column a card left swapped for the one it landed in; the
 * column of tasks without a value takes them all away.
 */
function moveValue(values: string[], from: string, to: string, keyOf: (value: string) => string): string[] {
  if (!to) return []
  const next = values.filter((value) => keyOf(value) !== keyOf(from))
  if (!next.some((value) => keyOf(value) === keyOf(to))) next.push(to)
  return next
}

export class KanbanView implements SubView {
  private dragTask: Task | null = null
  private dragFrom: string | null = null
  private setup!: FilterSetup
  /** Resolved once per board render. */
  private config!: ResolvedProjectConfig
  private filterContext!: FilterContext
  /** The card fields, resolved once per board render. */
  private cardFields: string[] = []

  constructor(
    private container: HTMLElement,
    private scope: ProjectScope,
    private plugin: LowLevelKanbanPlugin,
    private onRefresh: () => Promise<void>,
    private query: TaskQuery,
    private sort: SortRule[],
    private group: GroupState,
    private fields: ViewFields,
    /** Opens the Group popover from the strip that stands in for hidden columns. */
    private onShowHidden: (anchor: HTMLElement) => void
  ) {}

  render(): void {
    this.renderBoard()
    if (this.cardFields.includes('description')) {
      void this.hydrateDescriptions()
    }
  }

  private renderBoard(): void {
    this.config = this.scope.config
    this.setup = this.scope.filterSetup(this.query.filter, personKeyer(this.plugin.app))
    this.filterContext = this.setup.ctx
    this.cardFields = shownFields(this.fields, 'kanban', this.scope.fieldCatalog())
    this.container.empty()
    this.container.addClass('llk-kanban-view')

    const board = this.container.createDiv('llk-kanban-board')
    board.addEventListener('dragover', (e) => {
      e.preventDefault()
    })
    const columns = boardColumns(this.setup, this.group, this.visibleTasks())
    this.applyManualOrder(columns)
    for (const column of columns.filter((c) => !c.hidden)) {
      new KanbanColumn(board, {
        column,
        fields: this.cardFields,
        cards: column.tasks.map((task) => this.buildCardData(task)),
        onCardClick: (task) => this.openTask(task),
        onCardContextMenu: (task, e) => this.openContextMenu(task, e),
        onCardDragStart: (task) => {
          this.dragTask = task
          this.dragFrom = column.id
        },
        onCardDragEnd: () => {
          this.dragTask = null
          this.dragFrom = null
          this.clearDropState()
        },
        onDrop: (taskId, to, afterTaskId) => this.handleDrop(taskId, to, afterTaskId)
      })
    }

    const hidden = columns.filter((c) => c.hidden).length
    if (hidden) {
      const rail = new ChipButton(board)
        .setVariant('flat')
        .setIcon('eye-off')
        .setLabel(tn('header.hiddenCount', hidden))
        .setAriaLabel(t('header.showHiddenColumns'))
        .onClick(() => this.onShowHidden(rail.el))
      rail.el.addClass('llk-kanban-hidden-rail')
    }
  }

  /** Descriptions load lazily from the note body, so previews fill in on a second render. */
  private async hydrateDescriptions(): Promise<void> {
    const pending = boardCandidates(this.scope.tasks(), this.cardFields).filter(
      (t) => t.filePath && !t.description && matchesQuery(t, this.query, this.filterContext)
    )
    if (!pending.length) return
    await Promise.all(pending.map((t) => this.plugin.store.loadTaskBody(t)))
    if (pending.some((t) => t.description)) this.renderBoard()
  }

  private visibleTasks(): Task[] {
    return boardCandidates(this.scope.tasks(), this.cardFields)
      .filter((task) => matchesQuery(task, this.query, this.filterContext))
      .sort((a, b) => compareTasks(a, b, this.sort, this.config.statuses, this.config.priorities))
  }

  /** Manually dragged cards keep their dropped position; the rest keep their sorted order. */
  private applyManualOrder(columns: BoardColumn[]): void {
    const field = boardField(this.setup, this.group)
    for (const column of columns) {
      const key = `${field}:${column.id}`
      column.tasks
        .map((task, index) => ({ task, rank: task.manualOrder?.[key] ?? index }))
        .sort((a, b) => a.rank - b.rank)
        .forEach(({ task }, index) => {
          column.tasks[index] = task
        })
    }
  }

  private buildCardData(task: Task): KanbanCardData {
    const priorityConfig = getPriorityConfig(this.config.priorities, task.priority)
    const priorityColor = priorityConfig?.color

    const owner = this.scope.isMulti ? this.scope.projectOf(task.id) : null

    return {
      task,
      people: linkedRefs(this.plugin.app, task.assignees, task.filePath ?? ''),
      priorityColor,
      descriptionPreview: this.cardFields.includes('description') ? descriptionPreview(task.description) : undefined,
      customValues: cardCustomValues(task, this.scope.customFields(), this.cardFields),
      renderSource: owner
        ? (el) =>
            renderProjectChip(el, {
              title: owner.title,
              color: owner.color,
              onClick: safeAsync(() => this.plugin.router.openProjectLink(owner.filePath))
            })
        : undefined,
      overdue: dueUrgency(task, this.config.statuses) === 'overdue',
      tagColors: this.plugin.settings.tagColors,
      showTagColors: this.plugin.settings.showTagColors
    }
  }

  private openTask(task: Task): void {
    const owner = this.scope.projectOf(task.id)
    if (!owner) return
    openTaskModal(this.plugin, owner, {
      task,
      onSave: async () => {
        await this.onRefresh()
      }
    })
  }

  private openContextMenu(task: Task, e: MouseEvent): void {
    const owner = this.scope.projectOf(task.id)
    if (!owner) return
    const menu = new Menu()
    buildTaskContextMenu(menu, task, { plugin: this.plugin, project: owner, onRefresh: this.onRefresh })
    menu.showAtMouseEvent(e)
  }

  private clearDropState(): void {
    this.container.querySelectorAll('.llk-kanban-drop-placeholder').forEach((el) => el.remove())
    this.container.querySelectorAll('.llk-kanban-drop-target').forEach((el) => {
      el.classList.remove('llk-kanban-drop-target')
    })
  }

  private async handleDrop(taskId: string, to: string, afterTaskId?: string | null): Promise<void> {
    const task =
      this.dragTask && this.dragTask.id === taskId ? this.dragTask : this.scope.tasks().find((t) => t.id === taskId)
    const from = this.dragFrom ?? to
    if (!task) return
    const owner = this.scope.projectOf(taskId)
    if (!owner) return
    const fieldPatch = from === to ? null : this.dropPatch(task, from, to)
    const orderPatch = this.manualOrderPatch(task, to, afterTaskId)
    if (!fieldPatch && !orderPatch) return
    await this.plugin.store.updateTask(owner, task.id, { ...fieldPatch, ...orderPatch })
    await this.onRefresh()
  }

  /**
   * The card's rank in its target column, keyed by board field so the
   * same column id under a different grouping does not collide.
   */
  private manualOrderPatch(task: Task, columnId: string, afterTaskId?: string | null): Partial<Task> | null {
    const field = boardField(this.setup, this.group)
    const key = `${field}:${columnId}`
    const rank = this.dropRank(task.id, columnId, key, afterTaskId)
    if (rank === null) return null
    if (task.manualOrder?.[key] !== undefined && task.manualOrder[key] === rank) return null
    return { manualOrder: { ...task.manualOrder, [key]: rank } }
  }

  /** The dropped card's rank between its target column neighbours' ranks. */
  private dropRank(taskId: string, columnId: string, key: string, afterTaskId?: string | null): number | null {
    const columns = boardColumns(this.setup, this.group, this.visibleTasks())
    this.applyManualOrder(columns)
    const targetCol = columns.find((c) => c.id === columnId)
    if (!targetCol) return null

    const ranks = new Map<string, number>()
    targetCol.tasks.forEach((t, i) => ranks.set(t.id, t.manualOrder?.[key] ?? i))

    const neighbours = targetCol.tasks.filter((t) => t.id !== taskId)
    if (neighbours.length === 0) return 0

    const at =
      afterTaskId === null || afterTaskId === undefined
        ? neighbours.length
        : neighbours.findIndex((t) => t.id === afterTaskId)
    const validAt = at >= 0 ? at : neighbours.length

    const prevId = validAt > 0 ? neighbours[validAt - 1].id : null
    const nextId = validAt < neighbours.length ? neighbours[validAt].id : null

    const prevRank = prevId !== null ? ranks.get(prevId) : undefined
    const nextRank = nextId !== null ? ranks.get(nextId) : undefined

    if (prevRank === undefined) return nextRank === undefined ? 0 : nextRank - 1
    if (nextRank === undefined) return prevRank + 1
    if (prevRank === nextRank) return prevRank + 0.5
    return (prevRank + nextRank) / 2
  }

  /** What moving a card from one column to another changes on its task. Null where a move means nothing. */
  private dropPatch(task: Task, from: string, to: string): Partial<Task> | null {
    const field = boardField(this.setup, this.group)
    const keyOf = (value: string): string => valueKey(field, value, this.filterContext)
    switch (field) {
      case 'status':
        return { status: to }
      case 'priority':
        return { priority: to }
      case 'type':
        return to ? { type: to as TaskType } : null
      case 'assignee':
        return { assignees: moveValue(task.assignees, from, to, keyOf) }
      case 'tag':
        return { tags: moveValue(task.tags, from, to, keyOf) }
    }
    const custom = customFieldOf(field, this.filterContext.customFields)
    if (!custom) return null
    const next = custom.type === 'select' ? to : moveValue(groupValues(task, field, this.setup), from, to, keyOf)
    const customFields = Object.fromEntries(Object.entries(task.customFields).filter(([id]) => id !== custom.id))
    if (next.length) customFields[custom.id] = next
    return { customFields }
  }
}
