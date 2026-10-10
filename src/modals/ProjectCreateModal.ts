import { App, ButtonComponent, ExtraButtonComponent, Keymap, Modal, setIcon } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import { DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON, t } from '@low-level-kanban/core'
import { findIgnoringCase, newProjectFolder, projectFilePath } from '#store'
import { safeAsync, renderPropRow, renderIconControl, renderSelectControl } from '@low-level-kanban/ui'
import { saveShortcutLabel } from '../utils'
import { renderPersonPicker } from '#ui/PersonPicker'

interface Draft {
  title: string
  icon: string
  color: string
  parentPath: string
  teamMembers: string[]
  description: string
}

/** Everything a project needs to exist, asked once. Nothing is written until Create. */
export class ProjectCreateModal extends Modal {
  private draft: Draft = {
    title: '',
    icon: DEFAULT_PROJECT_ICON,
    color: DEFAULT_PROJECT_COLOR,
    parentPath: '',
    teamMembers: [],
    description: ''
  }
  private header!: HTMLElement
  private titleInput!: HTMLTextAreaElement
  private titleError!: HTMLElement
  private crumbFolder!: HTMLElement
  private pathHint!: HTMLElement
  private iconHost!: HTMLElement
  private submit!: ButtonComponent

  constructor(
    app: App,
    private plugin: LowLevelKanbanPlugin
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('llk-te-modal', 'llk-te-surface')
    this.modalEl.addClass('llk-modal', 'llk-modal--create')

    this.renderHeader(contentEl)

    const body = contentEl.createDiv('llk-te-body')
    this.renderTitle(body)

    const grid = body.createDiv('llk-te-props').createDiv('llk-prop-grid')
    this.renderIcon(grid)
    this.renderColor(grid)
    this.renderParent(grid)
    this.renderMembers(grid)

    this.renderDescription(body)

    this.renderFooter(contentEl)

    this.scope.register([this.plugin.settings.editorSaveModifier], 'Enter', () => {
      this.create()
      return false
    })
    this.refreshValidity()
    window.setTimeout(() => this.titleInput.focus(), 0)
  }

  onClose(): void {
    this.contentEl.empty()
  }

  private renderHeader(parent: HTMLElement): void {
    this.header = parent.createDiv('llk-te-header')
    this.paintAccent()
    const crumb = this.header.createDiv('llk-te-crumb')
    const folderIcon = crumb.createSpan({ cls: 'llk-te-crumb-icon' })
    setIcon(folderIcon, 'folder')
    this.crumbFolder = crumb.createSpan({ cls: 'llk-te-crumb-name', text: this.targetFolder() })
    const sep = crumb.createSpan({ cls: 'llk-te-crumb-sep' })
    setIcon(sep, 'chevron-right')
    crumb.createSpan({ text: t('projectCreate.crumb') })

    this.header.createDiv('llk-te-header-spacer')

    const closeBtn = new ExtraButtonComponent(this.header).setIcon('x').setTooltip(t('common.close'))
    closeBtn.extraSettingsEl.addClass('llk-te-header-btn')
    closeBtn.onClick(() => this.close())
  }

  private paintAccent(): void {
    this.header.setCssProps({ '--llk-accent-strip': this.draft.color })
  }

  private renderTitle(parent: HTMLElement): void {
    const wrap = parent.createDiv('llk-te-title-wrap')
    this.titleInput = wrap.createEl('textarea', { cls: 'llk-te-title' })
    this.titleInput.rows = 1
    this.titleInput.placeholder = t('project.namePlaceholder')
    this.titleInput.spellcheck = false
    this.titleError = wrap.createDiv({ cls: 'llk-modal-title-error', attr: { hidden: '' } })

    const autosize = () => {
      this.titleInput.setCssProps({ '--te-title-height': 'auto' })
      this.titleInput.setCssProps({ '--te-title-height': this.titleInput.scrollHeight + 'px' })
    }
    this.titleInput.addEventListener('input', () => {
      this.draft.title = this.titleInput.value
      autosize()
      this.refreshValidity()
    })
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !Keymap.isModifier(e, this.plugin.settings.editorSaveModifier)) e.preventDefault()
    })
    window.setTimeout(autosize, 0)
  }

  private renderIcon(parent: HTMLElement): void {
    renderPropRow(
      parent,
      t('project.icon'),
      () => {
        this.iconHost = createDiv('llk-prop-value')
        this.drawIcon()
        return this.iconHost
      },
      'smile'
    )
  }

  private drawIcon(): void {
    this.iconHost.empty()
    renderIconControl({
      container: this.iconHost,
      value: this.draft.icon,
      color: this.draft.color,
      onChange: (icon) => {
        this.draft.icon = icon
      }
    })
  }

  private renderColor(parent: HTMLElement): void {
    renderPropRow(
      parent,
      t('project.color'),
      () => {
        const cell = createDiv('llk-prop-value llk-prop-color')
        const picker = cell.createEl('input', { type: 'color', cls: 'llk-color-custom' })
        picker.value = this.draft.color
        picker.addEventListener('change', () => {
          this.draft.color = picker.value
          this.paintAccent()
          this.drawIcon()
        })
        return cell
      },
      'palette'
    )
  }

  private renderParent(parent: HTMLElement): void {
    renderPropRow(
      parent,
      t('project.parent'),
      () => {
        const cell = createDiv('llk-prop-value')
        const draw = (): void => {
          cell.empty()
          renderSelectControl({
            container: cell,
            value: this.draft.parentPath,
            placeholder: t('common.noParent'),
            search: true,
            options: [
              { id: '', label: t('common.noParent') },
              ...this.plugin.index.projectRefs().map((ref) => ({ id: ref.path, label: ref.title, color: ref.color }))
            ],
            onChange: (path) => {
              this.draft.parentPath = path
              draw()
              this.refreshValidity()
            }
          })
        }
        draw()
        return cell
      },
      'corner-up-right'
    )
  }

  private renderMembers(parent: HTMLElement): void {
    renderPropRow(
      parent,
      t('project.members'),
      () => {
        const cell = createDiv('llk-prop-value')
        renderPersonPicker({
          container: cell,
          plugin: this.plugin,
          // The note doesn't exist yet, so links are resolved from the vault root.
          sourcePath: '',
          addLabel: t('people.addMember'),
          selected: () => this.draft.teamMembers,
          add: (value) => {
            this.draft.teamMembers.push(value)
          },
          remove: (value) => {
            this.draft.teamMembers = this.draft.teamMembers.filter((name) => name !== value)
          }
        })
        return cell
      },
      'users'
    )
  }

  private renderDescription(parent: HTMLElement): void {
    const section = parent.createDiv('llk-modal-section llk-modal-desc-section')
    section.createEl('h4', { text: t('common.description'), cls: 'llk-modal-section-title' })
    const area = section.createEl('textarea', { cls: 'llk-modal-description' })
    area.placeholder = t('projectCreate.descriptionPlaceholder')
    const autoResize = () => {
      area.setCssProps({ '--desc-height': 'auto' })
      area.setCssProps({ '--desc-height': area.scrollHeight + 'px' })
    }
    area.addEventListener('input', () => {
      this.draft.description = area.value
      autoResize()
    })
    window.setTimeout(autoResize, 0)
  }

  private renderFooter(parent: HTMLElement): void {
    const footer = parent.createDiv('llk-te-footer')
    this.pathHint = footer.createSpan({ cls: 'llk-te-footer-path' })
    const fileIcon = this.pathHint.createSpan({ cls: 'llk-te-footer-icon' })
    setIcon(fileIcon, 'file-text')
    this.pathHint.createSpan()

    footer.createDiv('llk-footer-spacer')

    new ButtonComponent(footer).setButtonText(t('common.cancel')).onClick(() => this.close())
    this.submit = new ButtonComponent(footer)
      .setButtonText(
        t('projectCreate.submit', { shortcut: saveShortcutLabel(this.plugin.settings.editorSaveModifier) })
      )
      .setCta()
      .onClick(() => this.create())
  }

  private refreshValidity(): void {
    const title = this.draft.title.trim()
    const path = title ? this.targetPath(title) : ''
    const taken = !!path && !!findIgnoringCase(this.app, path)

    this.crumbFolder.setText(this.targetFolder())
    this.pathHint.lastElementChild?.setText(path)
    this.pathHint.toggleClass('llk-hidden', !path)
    if (taken) {
      this.titleError.setText(t('projectCreate.nameTaken'))
      this.titleError.removeAttribute('hidden')
      this.titleInput.addClass('llk-input-error')
    } else {
      this.titleError.setText('')
      this.titleError.setAttribute('hidden', '')
      this.titleInput.removeClass('llk-input-error')
    }
    this.submit.setDisabled(!title || taken)
  }

  private targetFolder(): string {
    return newProjectFolder(this.app, this.plugin.settings.projectsFolder, this.draft.parentPath || undefined)
  }

  private targetPath(title: string): string {
    return projectFilePath(title, this.targetFolder())
  }

  private readonly create = safeAsync(async () => {
    const title = this.draft.title.trim()
    if (!title || findIgnoringCase(this.app, this.targetPath(title))) return
    const project = await this.plugin.store.createProject(title, this.targetFolder(), {
      icon: this.draft.icon,
      color: this.draft.color,
      description: this.draft.description,
      teamMembers: this.draft.teamMembers,
      parentPath: this.draft.parentPath || undefined
    })
    this.close()
    await this.plugin.router.openProjectLink(project.filePath)
  })
}
