import { type Task, dueUrgency, getPriorityConfig, shownFields } from '@low-level-kanban/core'
import { KanbanColumn, type KanbanCardData } from '../composites/KanbanColumn'
import { applyManualOrder, boardColumns } from './boardColumns'
import { cardCustomValues, descriptionPreview } from './boardCards'
import { renderProjectChip } from '../composites/projectChip'
import {
  boardTasks,
  configOf,
  customFieldColumns,
  fieldCatalogOf,
  filterSetupOf,
  isMulti,
  personOf,
  projectOf,
  type ViewModel
} from './model'

const noop = (): void => {}
const noDrop = async (): Promise<void> => {}

function cardData(model: ViewModel, task: Task, fields: string[]): KanbanCardData {
  const config = configOf(model, task.id)
  const priorityConfig = getPriorityConfig(config.priorities, task.priority)
  const owner = isMulti(model) ? projectOf(model, task.id) : null
  return {
    task,
    people: task.assignees.map((raw) => personOf(model, raw)),
    priorityColor: priorityConfig?.color,
    descriptionPreview: fields.includes('description') ? descriptionPreview(task.description) : undefined,
    customValues: cardCustomValues(task, customFieldColumns(model), fields),
    renderSource: owner
      ? (el) => renderProjectChip(el, { title: owner.title, color: owner.color, onClick: noop })
      : undefined,
    overdue: dueUrgency(task, config.statuses) === 'overdue',
    tagColors: model.settings.tagColors,
    showTagColors: model.settings.showTagColors
  }
}

/** The board without drag, menus or editing: the columns the view grouped by, cards in the order it sorted. */
export function renderSnapshotKanban(container: HTMLElement, model: ViewModel): HTMLElement {
  container.addClass('llk-kanban-view')
  const board = container.createDiv('llk-kanban-board')
  if (!model.projects.length) return board
  const fields = shownFields(model.fields, 'kanban', fieldCatalogOf(model))
  const tasks = boardTasks(model)
  const setup = filterSetupOf(model)
  const columns = boardColumns(setup, model.group, tasks)
  applyManualOrder(setup, model.group, columns)
  for (const column of columns.filter((c) => !c.hidden)) {
    new KanbanColumn(board, {
      column,
      fields,
      cards: column.tasks.map((task) => cardData(model, task, fields)),
      onCardClick: noop,
      onCardContextMenu: noop,
      onCardDragStart: noop,
      onCardDragEnd: noop,
      onDrop: noDrop
    })
  }
  return board
}
