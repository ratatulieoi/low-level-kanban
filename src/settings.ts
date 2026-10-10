import { App, Notice, PluginSettingTab, Setting, debounce } from 'obsidian'
import type { SettingDefinitionItem, SettingDefinitionPage } from 'obsidian'
import type LowLevelKanbanPlugin from './main'
import {
  type LowLevelKanbanSettings,
  DEFAULT_PALETTE_COLOR,
  DEFAULT_SETTINGS,
  priorityIconSetLabels,
  makeId,
  flattenTasks,
  setDateFormat,
  stringToColor,
  t,
  tn
} from '@low-level-kanban/core'
import { saveShortcutLabel } from './utils'
import { renderCustomFieldFields, renderCustomFieldOptions } from '@low-level-kanban/ui'
import {
  countTaskNotesPaletteChanges,
  getTaskNotesApi,
  importTaskNotesPalettes,
  isTaskNotesInstalled
} from './integrations/tasknotes'
import { renderPaletteFields, renderStatusDoneToggle } from './ui/PaletteListEditor'
import { renderPersonPicker } from './ui/PersonPicker'
import { promptText } from './ui/ModalFactory'

export type { LowLevelKanbanSettings }
export { DEFAULT_SETTINGS }

/**
 * Per-tag custom colors, keyed by tag as stored. Kept local to this module because the
 * core settings type is owned elsewhere; optional so settings built from core defaults
 * still fit until the core type gains the field.
 */
export interface TagColorSettings {
  tagColors?: Record<string, string>
}

export const DEFAULT_TAG_COLORS: Record<string, string> = {}

/** A tag's custom color when set, otherwise the automatic one. Mirrors `personColor`. */
export function getTagColor(settings: LowLevelKanbanSettings & TagColorSettings, tag: string): string {
  return settings.tagColors?.[tag] ?? stringToColor(tag)
}

export class LowLevelKanbanSettingTab extends PluginSettingTab {
  plugin: LowLevelKanbanPlugin
  /** A folder name is typed one character at a time; each sweep costs the whole vault. */
  private readonly rebuildIndex: () => void

  constructor(app: App, plugin: LowLevelKanbanPlugin) {
    super(app, plugin)
    this.plugin = plugin
    this.icon = 'kanban'
    this.rebuildIndex = debounce(() => this.plugin.index.build(), 500)
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        heading: t('settings.general.heading'),
        items: [
          {
            name: t('settings.projectsFolder.name'),
            desc: t('settings.projectsFolder.desc'),
            aliases: ['projects folder', 'location'],
            control: {
              type: 'folder',
              key: 'projectsFolder',
              defaultValue: 'Projects',
              placeholder: t('settings.projectsFolder.placeholder')
            }
          },
          this.excludedFoldersPage(),
          {
            name: t('settings.projectSurface.name'),
            desc: t('settings.projectSurface.desc'),
            aliases: ['click', 'project list', 'overview'],
            control: {
              type: 'dropdown',
              key: 'projectSurface',
              options: { overview: t('settings.projectSurface.overview'), tasks: t('settings.projectSurface.tasks') }
            }
          },
          {
            name: t('settings.taskEditorSurface.name'),
            desc: t('settings.taskEditorSurface.desc'),
            control: {
              type: 'dropdown',
              key: 'taskEditorSurface',
              options: { modal: t('settings.taskEditorSurface.modal'), tab: t('settings.taskEditorSurface.tab') }
            }
          },
          {
            name: t('settings.saveTaskOnClose.name'),
            desc: t('settings.saveTaskOnClose.desc'),
            control: { type: 'toggle', key: 'saveTaskOnClose' }
          },
          {
            name: t('settings.saveShortcut.name'),
            desc: t('settings.saveShortcut.desc'),
            aliases: ['hotkey', 'keyboard'],
            control: {
              type: 'dropdown',
              key: 'editorSaveModifier',
              options: { Shift: saveShortcutLabel('Shift'), Mod: saveShortcutLabel('Mod') }
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('settings.style.heading'),
        items: [
          {
            name: t('settings.showTagColors.name'),
            desc: t('settings.showTagColors.desc'),
            aliases: ['appearance'],
            control: { type: 'toggle', key: 'showTagColors' }
          },
          this.tagColorsPage(),
          {
            name: t('settings.dateFormat.name'),
            desc: t('settings.dateFormat.desc'),
            aliases: ['appearance', 'date', 'moment'],
            control: { type: 'text', key: 'dateFormat', placeholder: 'YYYY-MM-DD' }
          },
          {
            name: t('settings.priorityIcons.name'),
            desc: t('settings.priorityIcons.desc'),
            aliases: ['appearance', 'chevrons', 'signal'],
            control: {
              type: 'dropdown',
              key: 'priorityIcons',
              options: priorityIconSetLabels()
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('dashboard.title'),
        items: [
          {
            name: t('settings.showSubtreeConnections.name'),
            desc: t('settings.showSubtreeConnections.desc'),
            aliases: ['tree', 'indent', 'subtask'],
            control: { type: 'toggle', key: 'showSubtreeConnections' }
          },
          {
            name: t('settings.lineBorders.name'),
            desc: t('settings.lineBorders.desc'),
            aliases: ['grid', 'lines'],
            control: {
              type: 'dropdown',
              key: 'lineBorders',
              options: {
                none: t('settings.lineBorders.none'),
                horizontal: t('settings.lineBorders.horizontal'),
                vertical: t('settings.lineBorders.vertical'),
                both: t('settings.lineBorders.both')
              }
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('settings.scheduling.heading'),
        items: [
          {
            name: t('settings.autoSchedule.name'),
            desc: t('settings.autoSchedule.desc'),
            aliases: ['dependencies'],
            control: { type: 'toggle', key: 'autoSchedule' }
          },
          {
            name: t('settings.pullForward.name'),
            desc: t('settings.pullForward.desc'),
            aliases: ['dependencies'],
            control: {
              type: 'toggle',
              key: 'pullForwardOnEarlyFinish',
              disabled: () => !this.plugin.settings.autoSchedule
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('settings.archive.heading'),
        items: [
          {
            name: t('settings.autoArchiveDays.name'),
            desc: t('settings.autoArchiveDays.desc'),
            aliases: ['archive', 'cleanup', 'done'],
            control: {
              type: 'slider',
              key: 'autoArchiveDays',
              min: 0,
              max: 90,
              step: 1
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('settings.notifications.heading'),
        items: [
          {
            name: t('settings.notificationsEnabled.name'),
            desc: t('settings.notificationsEnabled.desc'),
            aliases: ['notifications', 'banner'],
            control: { type: 'toggle', key: 'notificationsEnabled' }
          },
          {
            name: t('settings.notificationLeadDays.name'),
            desc: t('settings.notificationLeadDays.desc'),
            aliases: ['notifications', 'reminders', 'lead time'],
            control: {
              type: 'slider',
              key: 'notificationLeadDays',
              min: 1,
              max: 14,
              step: 1,
              disabled: () => !this.plugin.settings.notificationsEnabled
            }
          }
        ]
      },
      {
        type: 'group',
        heading: t('settings.taskFields.heading'),
        items: [this.statusesPage(), this.prioritiesPage(), this.customFieldsPage(), this.teamMembersPage()]
      },
      {
        type: 'group',
        heading: t('settings.integrations.heading'),
        visible: () => isTaskNotesInstalled(this.app),
        items: [this.taskNotesPage()]
      }
    ]
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    await super.setControlValue(key, value)
    // Today's pass ran against the old window, so it has to run again to reflect the new one.
    if (key === 'autoArchiveDays') {
      this.plugin.settings.lastAutoArchiveDate = ''
      await this.plugin.autoArchiver.check()
    }
    if (key === 'dateFormat') setDateFormat(this.plugin.settings.dateFormat)
    this.plugin.refreshViews()
    this.refreshDomState()
  }

  private statusesPage(): SettingDefinitionPage {
    const statuses = this.plugin.settings.statuses
    return {
      type: 'page',
      name: t('settings.statuses.name'),
      desc: t('settings.statuses.desc'),
      displayValue: () => tn('settings.statusCount', this.plugin.settings.statuses.length),
      items: [
        {
          type: 'list',
          heading: t('settings.statuses.name'),
          emptyState: t('settings.statuses.empty'),
          items: statuses.map((status) => ({
            name: status.label,
            render: (setting: Setting) => {
              setting.setClass('llk-palette-row')
              renderPaletteFields(setting.controlEl, status, () => this.persist())
              renderStatusDoneToggle(setting.controlEl, status, () => this.persist())
            }
          })),
          onReorder: (from, to) => this.reorder(statuses, from, to),
          onDelete: (index) => this.deleteEntry('status', index),
          addItem: {
            name: t('settings.statuses.add'),
            action: () => {
              statuses.push({
                id: 'status-' + makeId().slice(0, 6),
                label: t('settings.statuses.newLabel'),
                color: DEFAULT_PALETTE_COLOR,
                icon: '',
                complete: false
              })
              this.persist()
              this.update()
            }
          }
        }
      ]
    }
  }

  private customFieldsPage(): SettingDefinitionPage {
    const fields = this.plugin.settings.customFields
    return {
      type: 'page',
      name: t('settings.customFields.name'),
      desc: t('settings.customFields.desc'),
      displayValue: () => tn('settings.fieldCount', this.plugin.settings.customFields.length),
      items: [
        {
          type: 'list',
          heading: t('settings.customFields.name'),
          emptyState: t('settings.customFields.empty'),
          items: fields.map((field) => ({
            name: field.name,
            render: (setting: Setting) => {
              setting.setClass('llk-palette-row')
              setting.setClass('llk-cf-settings-row')
              renderCustomFieldFields(
                setting.controlEl,
                field,
                () => this.persist(),
                () => this.update()
              )
              renderCustomFieldOptions(setting.controlEl, field, () => this.persist())
            }
          })),
          onReorder: (from, to) => this.reorder(fields, from, to),
          onDelete: (index) => {
            fields.splice(index, 1)
            this.persist()
            this.update()
          },
          addItem: {
            name: t('settings.customFields.add'),
            action: () => {
              fields.push({ id: makeId(), name: t('settings.customFields.newLabel'), type: 'text' })
              this.persist()
              this.update()
            }
          }
        }
      ]
    }
  }

  private prioritiesPage(): SettingDefinitionPage {
    const priorities = this.plugin.settings.priorities
    return {
      type: 'page',
      name: t('settings.priorities.name'),
      desc: t('settings.priorities.desc'),
      displayValue: () => tn('settings.priorityCount', this.plugin.settings.priorities.length),
      items: [
        {
          type: 'list',
          heading: t('settings.priorities.name'),
          emptyState: t('settings.priorities.empty'),
          items: priorities.map((priority) => ({
            name: priority.label,
            render: (setting: Setting) => {
              setting.setClass('llk-palette-row')
              renderPaletteFields(setting.controlEl, priority, () => this.persist())
            }
          })),
          onReorder: (from, to) => this.reorder(priorities, from, to),
          onDelete: (index) => this.deleteEntry('priority', index),
          addItem: {
            name: t('settings.priorities.add'),
            action: () => {
              priorities.push({
                id: 'priority-' + makeId().slice(0, 6),
                label: t('settings.priorities.newLabel'),
                color: DEFAULT_PALETTE_COLOR,
                icon: ''
              })
              this.persist()
              this.update()
            }
          }
        }
      ]
    }
  }

  private taskNotesPage(): SettingDefinitionPage {
    const connected = (): boolean => getTaskNotesApi(this.app) !== null
    return {
      type: 'page',
      name: t('settings.taskNotes.name'),
      desc: t('settings.taskNotes.desc'),
      displayValue: () => this.taskNotesStatus(),
      status: () => (connected() ? null : 'warning'),
      items: [
        {
          type: 'list',
          extraButtons: [
            (button) =>
              button
                .setIcon('refresh-cw')
                .setTooltip(t('settings.taskNotes.import'))
                .setDisabled(!connected())
                .onClick(() => this.importFromTaskNotes())
          ],
          items: [
            {
              name: t('settings.taskNotes.palettes.name'),
              desc: t('settings.taskNotes.palettes.desc'),
              render: (setting: Setting) => {
                setting.controlEl.createDiv({ cls: 'setting-item-value', text: this.taskNotesStatus() })
              }
            }
          ]
        }
      ]
    }
  }

  /** Whether an import would change anything right now. */
  private taskNotesStatus(): string {
    const api = getTaskNotesApi(this.app)
    if (!api) return t('settings.taskNotes.updateRequired')
    const { added, updated } = countTaskNotesPaletteChanges(api, this.plugin.settings)
    const total = added + updated
    return total === 0 ? t('settings.taskNotes.upToDate') : tn('settings.changeCount', total)
  }

  private excludedFoldersPage(): SettingDefinitionPage {
    const folders = this.plugin.settings.excludedFolders
    return {
      type: 'page',
      name: t('settings.excludedFolders.name'),
      desc: t('settings.excludedFolders.desc'),
      displayValue: () => tn('settings.folderCount', this.plugin.settings.excludedFolders.length),
      items: [
        {
          type: 'list',
          heading: t('settings.excludedFolders.name'),
          emptyState: t('settings.excludedFolders.empty'),
          items: folders.map((folder, index) => ({
            name: folder || t('settings.excludedFolders.unnamed'),
            render: (setting: Setting) => {
              setting.setClass('llk-palette-row')
              setting.addText((text) =>
                text
                  .setPlaceholder(t('settings.excludedFolders.placeholder'))
                  .setValue(folder)
                  .onChange((value) => {
                    this.plugin.settings.excludedFolders[index] = value
                    this.persist()
                    this.rebuildIndex()
                  })
              )
            }
          })),
          onDelete: (index) => {
            folders.splice(index, 1)
            this.persist()
            this.plugin.index.build()
            this.update()
          },
          addItem: {
            name: t('settings.excludedFolders.add'),
            action: () => {
              folders.push('')
              this.persist()
              this.update()
            }
          }
        }
      ]
    }
  }

  private teamMembersPage(): SettingDefinitionPage {
    const members = this.plugin.settings.globalTeamMembers
    return {
      type: 'page',
      name: t('settings.teamMembers.name'),
      desc: t('settings.teamMembers.desc'),
      displayValue: () => tn('settings.personCount', this.plugin.settings.globalTeamMembers.length),
      items: [
        {
          name: t('settings.peopleFolder.name'),
          desc: t('settings.peopleFolder.desc'),
          aliases: ['people', 'person notes'],
          control: {
            type: 'folder',
            key: 'peopleFolder',
            defaultValue: 'People',
            placeholder: t('settings.peopleFolder.placeholder')
          }
        },
        {
          name: t('settings.teamMembersList.name'),
          desc: t('settings.teamMembersList.desc'),
          render: (setting: Setting) => {
            renderPersonPicker({
              container: setting.controlEl,
              plugin: this.plugin,
              sourcePath: '',
              addLabel: t('people.addMember'),
              selected: () => this.plugin.settings.globalTeamMembers,
              add: (value) => {
                members.push(value)
                this.persist()
              },
              remove: (value) => {
                const index = members.indexOf(value)
                if (index >= 0) members.splice(index, 1)
                this.persist()
              }
            })
          }
        }
      ]
    }
  }

  private tagColorsPage(): SettingDefinitionPage {
    const tagColors = this.plugin.settings.tagColors ?? (this.plugin.settings.tagColors = {})
    const tags = Object.keys(tagColors)
    return {
      type: 'page',
      name: t('settings.tagColors.name'),
      desc: t('settings.tagColors.desc'),
      displayValue: () => tn('settings.tagCount', Object.keys(this.plugin.settings.tagColors ?? {}).length),
      items: [
        {
          type: 'list',
          heading: t('settings.tagColors.name'),
          emptyState: t('settings.tagColors.empty'),
          items: tags.map((tag) => ({
            name: tag,
            render: (setting: Setting) => {
              setting.setClass('llk-palette-row')
              const color = tagColors[tag] ?? stringToColor(tag)
              setting.addColorPicker((picker) =>
                picker.setValue(color).onChange((value) => {
                  tagColors[tag] = value
                  this.persist()
                })
              )
            }
          })),
          onDelete: (index) => {
            const tagToDelete = tags[index]
            if (tagToDelete !== undefined) {
              Reflect.deleteProperty(tagColors, tagToDelete)
              this.persist()
              this.update()
            }
          },
          addItem: {
            name: t('settings.tagColors.add'),
            action: () => {
              void (async () => {
                const name = await promptText(
                  this.app,
                  t('settings.tagColors.promptTitle'),
                  t('settings.tagColors.promptPlaceholder')
                )
                if (!name) return
                const clean = name.trim().replace(/^#/, '')
                if (!clean) return
                if (!(clean in tagColors)) {
                  tagColors[clean] = stringToColor(clean)
                  this.persist()
                  this.update()
                }
              })()
            }
          }
        }
      ]
    }
  }

  private persist(): void {
    void this.plugin.saveSettings()
    this.plugin.refreshViews()
  }

  private reorder<T>(items: T[], from: number, to: number): void {
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
    this.persist()
    this.update()
  }

  private deleteEntry(field: 'status' | 'priority', index: number): void {
    const entries = field === 'status' ? this.plugin.settings.statuses : this.plugin.settings.priorities
    if (entries.length <= 1) {
      new Notice(t(field === 'status' ? 'settings.atLeastOneStatus' : 'settings.atLeastOnePriority'))
      return
    }
    const [removed] = entries.splice(index, 1)
    this.persist()
    this.update()
    void this.remapOrphanTasks(field, removed.id, removed.label)
  }

  private importFromTaskNotes(): void {
    const api = getTaskNotesApi(this.app)
    if (!api) {
      new Notice(t('settings.taskNotes.required'))
      return
    }
    const { added, updated } = importTaskNotesPalettes(api, this.plugin.settings)
    this.persist()
    this.update()
    new Notice(
      added || updated ? t('settings.taskNotes.imported', { added, updated }) : t('settings.taskNotes.alreadyMatch')
    )
  }

  private async remapOrphanTasks(field: 'status' | 'priority', deletedId: string, deletedLabel: string): Promise<void> {
    const configs = field === 'status' ? this.plugin.settings.statuses : this.plugin.settings.priorities
    if (configs.length === 0) return
    const fallback = configs[0]
    // Only projects the index says still use the deleted value are worth loading.
    const affected = this.plugin.index
      .projectRefs(true)
      .filter((ref) => this.plugin.index.taskRefs(ref.path).some((task) => task[field] === deletedId))
      .map((ref) => ref.path)
    const projects = await this.plugin.store.loadProjects(affected)
    let remapped = 0
    for (const project of projects) {
      // A project defining this status or priority itself is unaffected by a global delete.
      const own = field === 'status' ? project.config?.statuses : project.config?.priorities
      if (own?.some((entry) => entry.id === deletedId)) continue
      const ids = flattenTasks(project.tasks)
        .filter(({ task }) => task[field] === deletedId)
        .map(({ task }) => task.id)
      if (ids.length) {
        await this.plugin.store.updateTasks(project, ids, { [field]: fallback.id })
        remapped += ids.length
      }
    }
    if (remapped > 0) {
      new Notice(tn('settings.remappedTasks', remapped, { from: deletedLabel, to: fallback.label }))
    }
  }
}
