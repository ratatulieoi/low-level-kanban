import { ItemView, Menu, Platform, Scope, WorkspaceLeaf } from 'obsidian'
import type LowLevelKanbanPlugin from '#main'
import { addTabPageItems, refreshTabTitle } from '#ui/tab'
import {
  type Project,
  type SavedView,
  type ResolvedProjectConfig,
  type SortRule,
  type GroupState,
  type TaskQuery,
  type ViewFields,
  flattenTasks,
  shownFields,
  withDefault,
  bestConditionToDrop,
  countActiveFilters,
  filterFieldLabel,
  isQueryActive,
  makeDefaultFilter,
  makeDefaultGroup,
  makeDefaultSort,
  sameValue,
  viewDifferences,
  makeId,
  matchesQuery,
  t,
  tn
} from '@low-level-kanban/core'
import {
  folderOf,
  personKeyer,
  ProjectScope,
  projectFolderOf,
  type ProjectRef,
  resolveScopePaths,
  scopeKey,
  type ScopeSpec,
  selectionSpec
} from '#store'
import {
  boardCandidates,
  boardColumns,
  boardField,
  ChipButton,
  EmptyState,
  groupableFields,
  openFieldsPopover,
  openGroupPopover,
  type BoardColumn,
  FilterBar,
  openProjectSwitcher,
  openSavedViewsPopover,
  openSearchPopover,
  openSortPopover,
  renderFieldsPanel,
  renderFilterPanel,
  renderGroupPanel,
  renderSortPanel,
  renderBreadcrumb,
  safeAsync,
  SearchBox,
  showMenuBelow,
  SplitButton,
  ViewHeader,
  type FieldsPopoverProps,
  type FilterSetup,
  type GroupPopoverProps,
  type PlatformMenu,
  type SearchBoxProps,
  type SheetTab,
  type SortPopoverProps,
  type TuneSheetProps,
  type SortField,
  type SwitcherProject,
  type TuneItem,
  SavedViewSlot,
  summarizeSort,
  syncSortButton,
  type SortSummary
} from '@low-level-kanban/ui'
import type { SubView } from './SubView'
import type { ExportViewState } from '../export/snapshot'
import { KanbanView } from './KanbanView'
import { openTaskModal } from '#ui/ModalFactory'
import { exportViewAsHtml } from '../export/exportView'

import { LLK_PROJECT_VIEW_TYPE } from './viewTypes'

interface ProjectViewState {
  scope?: ScopeSpec
  /** How a project view was addressed before scopes; still accepted from saved layouts. */
  filePath?: string
  anchor?: string
  [key: string]: unknown
}

const SCOPE_ICONS = { picked: 'layers', folder: 'folder', vault: 'vault' }

function ends(list: { label: string }[]): [string, string] | undefined {
  return list.length ? [list[0].label, list[list.length - 1].label] : undefined
}

const sortFields = (config?: ResolvedProjectConfig): SortField[] => [
  { id: 'title', label: t('columns.task') },
  { id: 'status', label: t('columns.status'), ends: config && ends(config.statuses) },
  { id: 'priority', label: t('columns.priority'), ends: config && ends(config.priorities) },
  { id: 'assignees', label: t('columns.assignees') },
  { id: 'due', label: t('columns.due') },
  { id: 'progress', label: t('columns.progress') }
]

function specOf(state: ProjectViewState): ScopeSpec | null {
  if (state.scope) return state.scope
  if (state.filePath) return { kind: 'project', path: state.filePath }
  return null
}

export class ProjectView extends ItemView {
  plugin: LowLevelKanbanPlugin
  projectScope: ProjectScope | null = null
  private spec: ScopeSpec | null = null
  /** The project last shown on its own, which "This project" returns to from a wider scope. */
  private anchorPath: string | null = null
  /** The saved filter plus the search text, which lives only as long as this view. */
  query: TaskQuery = { filter: makeDefaultFilter(), text: '' }
  activeSavedViewId: string | null = null
  sort: SortRule[] = makeDefaultSort()
  group: GroupState = makeDefaultGroup()
  fields: ViewFields = {}
  private subview: SubView | null = null
  private headerEl!: HTMLElement
  private bodyEl!: HTMLElement
  private emptyEl!: HTMLElement
  private header: ViewHeader | null = null
  private filterBar: FilterBar | null = null
  private searchBox: SearchBox | null = null
  private queryBarOpen = false
  private viewSlot: SavedViewSlot | null = null
  private filterButton: ChipButton | null = null
  private sortButton: ChipButton | null = null
  private groupButton: ChipButton | null = null
  private fieldsButton: ChipButton | null = null
  private keyScope: Scope
  private pendingRefresh: Promise<void> | null = null
  private initialized = false
  /**
   * The paths the current load covers, claimed before it starts. Loading a project can
   * write to it, and that write comes back as an index change, so comparing against the
   * projects already in hand would reload on top of a load that has not finished.
   */
  private loadedPaths: string[] = []

  constructor(leaf: WorkspaceLeaf, plugin: LowLevelKanbanPlugin) {
    super(leaf)
    this.plugin = plugin
    this.navigation = false
    this.keyScope = new Scope(this.app.scope)
    this.scope = this.keyScope
    this.keyScope.register(['Mod'], 's', () => {
      if (!this.viewChanges().length) return true
      safeAsync(() => this.updateActiveView())()
      return false
    })
  }

  getViewType(): string {
    return LLK_PROJECT_VIEW_TYPE
  }
  getDisplayText(): string {
    return this.projectScope?.label() ?? t('common.project')
  }

  /** The board state a reader of an export starts from. */
  exportState(): ExportViewState {
    return {
      mode: 'kanban',
      filter: structuredClone(this.query.filter),
      sort: structuredClone(this.sort),
      group: structuredClone(this.group),
      fields: structuredClone(this.fields)
    }
  }
  getIcon(): string {
    return 'kanban'
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source)
    const scope = this.projectScope
    const primary = scope?.primary
    if (!scope || !primary) return
    if (!scope.isMulti) addTabPageItems(menu, this.plugin, this.leaf, primary.filePath, ['overview', 'note', 'edit'])
    menu.addItem((item) =>
      item
        .setSection('action')
        .setTitle(t('commands.exportViewHtml'))
        .setIcon('file-output')
        .onClick(
          safeAsync(async () => {
            await exportViewAsHtml(this.plugin, this)
          })
        )
    )
  }

  /** The project a command should act on: the only one, or the group's primary. */
  get project(): Project | null {
    return this.projectScope?.primary ?? null
  }

  async setState(state: ProjectViewState, result: unknown): Promise<void> {
    const spec = specOf(state)
    if (typeof state.anchor === 'string') this.anchorPath = state.anchor
    if (spec && (!this.spec || scopeKey(this.spec) !== scopeKey(spec))) {
      this.spec = spec
      await this.loadScope()
    }
    await super.setState(state, result as import('obsidian').ViewStateResult)
  }

  getState(): ProjectViewState {
    return {
      scope: this.spec ?? undefined,
      filePath: this.projectScope?.primary?.filePath,
      anchor: this.anchorPath ?? undefined
    }
  }

  onOpen(): Promise<void> {
    // Setup only. setState is the sole loader; this just guarantees the scaffold and
    // listeners exist for hosts that open the view without it.
    this.ensureInitialized()
    return Promise.resolve()
  }

  onClose(): Promise<void> {
    this.subview?.destroy?.()
    this.subview = null
    this.header?.destroy()
    this.header = null
    return Promise.resolve()
  }

  // Pane Relief and Hover Editor restore a deferred leaf via setState without ever
  // calling onOpen, so the one-time setup runs from whichever fires first.
  private ensureInitialized(): void {
    if (this.initialized) return
    this.initialized = true

    this.containerEl.addClass('llk-view')
    const root = this.contentEl
    root.empty()
    root.addClass('llk-root')
    this.headerEl = root.createDiv('llk-vh-mount')
    this.bodyEl = root.createDiv('llk-content')
    this.emptyEl = root.createDiv('llk-filter-empty llk-hidden')

    this.register(
      this.plugin.store.onProjectChanged((path) => {
        if (this.scopeDependsOn(path)) this.redraw()
      })
    )
    this.register(this.plugin.index.onNoteColorChange(() => this.redraw()))
    // A scope changes when a project joins or leaves it, which for a single-project scope
    // includes the project appearing once the index has caught up with the vault.
    this.register(
      this.plugin.index.onChange(() => {
        if (!this.spec) return
        const paths = resolveScopePaths(this.spec, this.plugin.index)
        const current = this.loadedPaths
        if (paths.length !== current.length || paths.some((path, i) => path !== current[i])) {
          void this.loadScope()
        }
      })
    )
  }

  private scopeDependsOn(path: string): boolean {
    const projects = this.projectScope?.projects
    if (!projects) return false
    return projects.some(
      (project) =>
        project.filePath === path || this.plugin.index.ancestorRefs(project.filePath).some((ref) => ref.path === path)
    )
  }

  /**
   * Something outside the DOM changed: a project in scope, or a setting that decides how
   * it is drawn. The store keeps one instance per file, so the projects are already
   * current and only the DOM needs catching up.
   */
  redraw(): void {
    if (!this.projectScope || !this.spec) return
    if (!this.projectScope.primary) {
      this.renderEmptyScope()
      return
    }
    // A settings edit may have changed a palette, which the scope has resolved and kept.
    this.projectScope.invalidate()
    refreshTabTitle(this.leaf)
    // Rebuilding the header would drop the caret out of the search box.
    if (this.headerEl.contains(activeDocument.activeElement)) this.syncHeader()
    else this.renderHeader()
    void this.refreshProject()
  }

  private async loadScope(): Promise<void> {
    this.ensureInitialized()
    if (!this.spec) return
    if (this.spec.kind === 'project' || this.spec.kind === 'subtree') this.anchorPath = this.spec.path
    const paths = resolveScopePaths(this.spec, this.plugin.index)
    this.loadedPaths = paths
    const projects = await this.plugin.store.loadProjects(paths)
    this.projectScope = new ProjectScope(this.spec, projects, this.plugin.store)
    if (!this.projectScope.primary) {
      this.renderEmptyScope()
      return
    }
    this.loadFilterFromSettings()
    this.queryBarOpen = countActiveFilters(this.query.filter) > 0
    refreshTabTitle(this.leaf)
    this.renderHeader()
    this.renderCurrentView()
  }

  private async switchScope(spec: ScopeSpec): Promise<void> {
    this.spec = spec
    await this.loadScope()
    await this.leaf.setViewState({ type: LLK_PROJECT_VIEW_TYPE, state: this.getState() })
  }

  /** Moves this leaf to another scope, or opens it in a new tab. */
  private async goTo(spec: ScopeSpec, newTab: boolean): Promise<void> {
    if (newTab) {
      await this.plugin.router.openScope(spec)
      return
    }
    await this.switchScope(spec)
  }

  private loadFilterFromSettings(): void {
    const saved = this.projectScope ? this.plugin.settings.projectFilters[this.projectScope.key] : undefined
    if (saved) {
      this.query.filter = saved.filter
      this.activeSavedViewId = saved.activeSavedViewId
      this.sort = saved.sort
      this.group = saved.group
      this.fields = saved.fields
      return
    }
    this.query.filter = makeDefaultFilter()
    this.activeSavedViewId = null
    this.sort = makeDefaultSort()
    this.group = makeDefaultGroup()
    this.fields = structuredClone(this.plugin.settings.defaultFields)
    // A scope seen for the first time opens with its starred view, and keeps it from then on.
    const starred = this.savedViews().find((view) => view.isDefault)
    if (starred) {
      this.applySavedView(starred)
      void this.persistFilter()
    }
  }

  private applySavedView(view: SavedView): void {
    this.query.filter = structuredClone(view.filter)
    this.activeSavedViewId = view.id
    this.sort = structuredClone(view.sort)
    if (view.group) this.group = structuredClone(view.group)
    if (view.fields) this.fields = structuredClone(view.fields)
  }

  private activeView(): SavedView | undefined {
    return this.savedViews().find((view) => view.id === this.activeSavedViewId)
  }

  /** What differs from the active saved view, as the reader would name it. */
  private viewChanges(): string[] {
    const active = this.activeView()
    if (!active) return []
    const labels = {
      filter: t('header.changedFilter'),
      sort: t('header.changedSort'),
      group: t('header.changedGroup'),
      fields: t('header.changedFields')
    }
    const state = {
      filter: this.query.filter,
      sort: this.sort,
      group: this.group,
      fields: this.fields,
      mode: 'kanban' as const
    }
    return viewDifferences(active, state)
      .filter((part) => part !== 'mode')
      .map((part) => labels[part])
  }

  private async persistFilter(): Promise<void> {
    if (!this.projectScope) return
    this.plugin.settings.projectFilters[this.projectScope.key] = {
      filter: this.query.filter,
      activeSavedViewId: this.activeSavedViewId,
      sort: this.sort,
      group: this.group,
      fields: this.fields,
      viewMode: 'kanban'
    }
    await this.plugin.saveSettings()
  }

  /** One project owns its saved views; a group of them has no file to keep them in. */
  private savedViews(): SavedView[] {
    if (!this.projectScope) return []
    if (this.projectScope.spec.kind === 'project') return this.projectScope.primary?.savedViews ?? []
    return this.plugin.settings.scopeViews[this.projectScope.key] ?? []
  }

  private async persistSavedViews(views: SavedView[]): Promise<void> {
    if (!this.projectScope) return
    const primary = this.projectScope.primary
    if (this.projectScope.spec.kind === 'project' && primary) {
      primary.savedViews = views
      await this.plugin.store.saveProject(primary)
      return
    }
    this.plugin.settings.scopeViews[this.projectScope.key] = views
    await this.plugin.saveSettings()
  }

  private renderEmptyScope(): void {
    this.header?.destroy()
    this.header = null
    this.filterBar = null
    this.headerEl.empty()
    this.bodyEl.empty()
    this.bodyEl.removeClass('llk-hidden')
    this.emptyEl.addClass('llk-hidden')
    const msg = this.bodyEl.createDiv('llk-empty-state')
    msg.createEl('h3', { text: t('projectView.nothingToShow') })
    msg.createEl('p', { text: t('projectView.missing') })
  }

  private renderHeader(): void {
    const scope = this.projectScope
    const primary = scope?.primary
    if (!scope || !primary) return
    this.header?.destroy()
    const header = new ViewHeader(this.headerEl)
    this.header = header
    this.renderContextSlot(header.context, scope, primary)
    this.renderViewSlot(header.view)
    this.renderQuerySlot(header.query)
    this.renderActionsSlot(header.actions)
    header.setTuneItems(() => this.tuneItems()).setTuneSheet(() => this.tuneSheet())
    if (!scope.isMulti) header.setMoreMenu((menu) => this.fillMoreMenu(menu))
    this.renderFilterBar()
    this.syncHeader()
  }

  /** Brings the parts that follow the filter, sort and task counts up to date without rebuilding them. */
  private syncHeader(): void {
    const active = this.activeView()
    const counts = this.taskCounts()
    this.viewSlot?.sync({
      name: active?.name ?? t('header.allTasks'),
      saved: !!active,
      dirty: this.viewChanges().length > 0,
      count: this.countLabel(counts)
    })
    this.filterBar?.setSummary(t('header.shownSummary', { shown: counts.shown, total: counts.total }))
    this.syncFilterEmpty(counts)
    const filters = countActiveFilters(this.query.filter)
    this.filterButton?.setBadge(filters).setActive(filters > 0)
    this.searchBox?.setValue(this.query.text)
    this.header?.tune.setBadge(filters).setActive(isQueryActive(this.query))
    if (this.groupButton) {
      const label = this.groupSummary()
      const hidden = this.boardColumnsNow().filter((column) => column.hidden).length
      this.groupButton
        .setLabel(label || t('header.group'))
        .setDetail(hidden ? tn('header.hiddenCount', hidden) : '')
        .setActive(!!label)
    }
    if (this.fieldsButton) {
      const hidden = this.hiddenFieldCount()
      this.fieldsButton
        .setDetail(hidden ? tn('header.hiddenCount', hidden) : '')
        .setActive(this.fields.kanban !== undefined)
    }
    if (this.sortButton) syncSortButton(this.sortButton, this.sortSummary())
    this.header?.fit()
  }

  /** Replaces a body the filter has emptied with a way back: the one condition that frees the most tasks. */
  private syncFilterEmpty(counts: { shown: number; total: number }): void {
    const scope = this.projectScope
    const emptied = !!scope && isQueryActive(this.query) && counts.shown === 0 && counts.total > 0
    this.emptyEl.empty()
    this.emptyEl.toggleClass('llk-hidden', !emptied)
    this.bodyEl.toggleClass('llk-hidden', emptied)
    if (!scope || !emptied) return
    const state = new EmptyState(this.emptyEl).setIcon('search-x')
    const { conditions } = this.query.filter
    if (!conditions.length) {
      state.setTitle(t('filter.noSearchMatch', { text: this.query.text.trim() }))
      return
    }
    const ctx = scope.filterContext(personKeyer(this.plugin.app))
    const tasks = flattenTasks(scope.tasks()).map((flat) => flat.task)
    const best = bestConditionToDrop(tasks, this.query, ctx)
    const apply = (): void => {
      this.handleFilterMutation()
      this.renderFilterBar()
    }
    state.setTitle(t('filter.emptyTitle'))
    if (best) {
      const label = filterFieldLabel(conditions[best.index].field, ctx.customFields)
      state
        .setBody(tn('filter.emptySuggest', best.shown, { label }))
        .setAction(t('filter.removeNamed', { label }), () => {
          conditions.splice(best.index, 1)
          apply()
        })
    } else {
      state.setBody(t('filter.emptyNone'))
    }
    state.addSecondaryAction(t('filter.clearAllFilters'), () => {
      this.query.filter.conditions = []
      apply()
    })
  }

  /** The tasks shown, and how many projects they come from when there are several. */
  private countLabel(counts: { shown: number; total: number }): string {
    const tasks = isQueryActive(this.query)
      ? t('header.shownOf', { shown: counts.shown, total: counts.total })
      : tn('header.taskCount', counts.total)
    const scope = this.projectScope
    if (!scope?.isMulti) return tasks
    return t('header.scopeCount', { projects: tn('scope.projectCount', scope.projects.length), tasks })
  }

  private taskCounts(): { shown: number; total: number } {
    const scope = this.projectScope
    if (!scope) return { shown: 0, total: 0 }
    const ctx = scope.filterContext(personKeyer(this.plugin.app))
    const all = flattenTasks(scope.tasks())
    const total = all.filter((flat) => this.query.filter.showArchived || !flat.task.archived).length
    const shown = all.filter((flat) => matchesQuery(flat.task, this.query, ctx)).length
    return { shown, total }
  }

  private renderContextSlot(parent: HTMLElement, scope: ProjectScope, primary: Project): void {
    const kind = scope.spec.kind
    const count = scope.projects.length
    const common = {
      onSwitch: (anchor: HTMLElement) => this.openSwitcher(anchor, scope, primary),
      switchLabel: t('header.switchProject'),
      foldLabel: t('header.parentProjects')
    }
    if (kind === 'project' || kind === 'subtree') {
      renderBreadcrumb(parent, {
        ...common,
        icon: primary.icon,
        color: primary.color,
        ancestors: this.plugin.index.ancestorRefs(primary.filePath).map((ref) => ({
          title: ref.title,
          onOpen: safeAsync((newTab: boolean) => this.goTo({ kind: 'project', path: ref.path }, newTab))
        })),
        title: primary.title,
        badge: count > 1 ? `+${count - 1}` : undefined
      })
      return
    }
    const named = kind === 'picked' ? scope.projects.slice(0, 2) : []
    let title = t('scope.all')
    if (kind === 'picked') title = named.map((project) => project.title).join(', ')
    else if (scope.spec.kind === 'folder') title = scope.spec.path || t('scope.vault')
    renderBreadcrumb(parent, {
      ...common,
      icon: SCOPE_ICONS[kind],
      ancestors: [],
      title,
      badge: kind === 'picked' && count > named.length ? `+${count - named.length}` : undefined,
      scoped: true
    })
  }

  private openSwitcher(anchor: HTMLElement, scope: ProjectScope, primary: Project): void {
    const index = this.plugin.index
    const spec = scope.spec
    const projects: SwitcherProject[] = []
    const add = (ref: ProjectRef, parent: string | undefined, folder: string): void => {
      projects.push({
        path: ref.path,
        title: ref.title,
        icon: ref.icon,
        color: ref.color,
        parent,
        folder,
        taskCount: index.counts(ref).total
      })
      for (const child of index.childRefs(ref.path)) add(child, ref.path, folder)
    }
    const roots = index.rootRefs().map((ref) => ({ ref, folder: this.containingFolder(ref.path) }))
    roots.sort((a, b) => a.folder.localeCompare(b.folder))
    for (const { ref, folder } of roots) add(ref, undefined, folder)

    const anchorProject = scope.projects.find((project) => project.filePath === this.anchorPath) ?? primary
    const path = spec.kind === 'project' || spec.kind === 'subtree' ? spec.path : anchorProject.filePath
    const folder = this.containingFolder(path)
    const options: { label: string; spec: ScopeSpec }[] = [
      {
        label: t('scope.only', { title: index.projectRef(path)?.title ?? anchorProject.title }),
        spec: { kind: 'project', path }
      }
    ]
    if (index.childRefs(path).length) options.push({ label: t('scope.subtree'), spec: { kind: 'subtree', path } })
    options.push(
      {
        label: folder ? t('scope.folder', { folder }) : t('scope.vaultFolder'),
        spec: { kind: 'folder', path: folder }
      },
      { label: t('scope.all'), spec: { kind: 'vault' } }
    )

    openProjectSwitcher(anchor, {
      projects,
      selected: scope.projects.map((project) => project.filePath),
      current: spec.kind === 'project' ? spec.path : undefined,
      presets: options.map((option) => ({
        label: option.label,
        active: scope.key === scopeKey(option.spec),
        onPick: safeAsync(() => this.goTo(option.spec, false))
      })),
      onPick: safeAsync((picked: string) => this.goTo({ kind: 'project', path: picked }, false)),
      onShow: safeAsync((paths: string[]) => {
        const descendantsOf = (of: string): string[] => index.descendantRefs(of).map((ref) => ref.path)
        return this.goTo(selectionSpec(paths, descendantsOf), false)
      })
    })
  }

  /** The folder a project sits in. A project owns its folder, so that is the one holding it. */
  private containingFolder(projectPath: string): string {
    return folderOf(projectFolderOf(this.app, projectPath) ?? projectPath)
  }

  private renderViewSlot(parent: HTMLElement): void {
    this.viewSlot = new SavedViewSlot(parent, {
      onOpen: (anchor) => this.openSavedViews(anchor),
      onSave: safeAsync(() => this.updateActiveView())
    })
  }

  private openSavedViews(anchor: HTMLElement): void {
    const primary = this.projectScope?.primary
    openSavedViewsPopover(anchor, {
      views: this.savedViews().map((view) => ({
        id: view.id,
        name: view.name,
        isDefault: view.isDefault
      })),
      activeId: this.activeSavedViewId,
      changes: this.viewChanges(),
      canSave:
        countActiveFilters(this.query.filter) > 0 ||
        !sameValue(this.sort, makeDefaultSort()) ||
        !sameValue(this.group, makeDefaultGroup()) ||
        Object.keys(this.fields).length > 0,
      builtInName: t('header.allTasks'),
      storageNote:
        this.projectScope?.spec.kind === 'project' && primary
          ? t('header.storedInNote', { name: primary.title })
          : t('header.storedInSettings'),
      onSelect: (id) => this.handleSavedViewSelect(id),
      onSave: (name, isDefault) => this.handleSavedViewSave(name, isDefault),
      onUpdate: (id) => this.handleSavedViewUpdate(id),
      onRevert: () => this.handleSavedViewSelect(this.activeSavedViewId),
      onRename: (id, name) => this.handleSavedViewRename(id, name),
      onDelete: (id) => this.handleSavedViewDelete(id),
      onReorder: (ids) => this.handleSavedViewReorder(ids),
      onSetDefault: (id) => this.handleSavedViewDefault(id)
    })
  }

  private async updateActiveView(): Promise<void> {
    if (this.activeSavedViewId && this.viewChanges().length) await this.handleSavedViewUpdate(this.activeSavedViewId)
  }

  private renderQuerySlot(parent: HTMLElement): void {
    this.searchBox = new SearchBox(parent, this.searchProps())
    this.filterButton = new ChipButton(parent)
      .setIcon('list-filter')
      .setLabel(t('header.filter'))
      .setAriaLabel(t('header.filter'))
      .onClick(() => this.openFilter())
    const sortButton = new ChipButton(parent).setAriaLabel(t('header.sort'))
    sortButton.onClick(() => this.openSort(sortButton.el))
    this.sortButton = sortButton
    const groupButton = new ChipButton(parent).setIcon('group').setAriaLabel(t('header.group'))
    groupButton.onClick(() => this.openGroup(groupButton.el))
    this.groupButton = groupButton
    const fieldsButton = new ChipButton(parent)
      .setIcon('columns-3')
      .setLabel(t('header.fields'))
      .setAriaLabel(t('header.fields'))
    fieldsButton.onClick(() => this.openFields(fieldsButton.el))
    this.fieldsButton = fieldsButton
  }

  private searchProps(): SearchBoxProps {
    return {
      value: this.query.text,
      label: t('header.search'),
      placeholder: t('taskForm.searchTasks'),
      clearLabel: t('common.clear'),
      onChange: (value) => {
        this.query.text = value
        this.syncHeader()
        this.refreshSubview()
      }
    }
  }

  private openFilter(): void {
    this.queryBarOpen = true
    if (!this.filterBar) this.renderFilterBar()
    this.filterBar?.openPicker()
  }

  private openSort(anchor: HTMLElement): void {
    openSortPopover(anchor, this.sortProps())
  }

  /** What the sort panel edits; `after` runs after each change, for a host that follows it. */
  private sortProps(after?: () => void): SortPopoverProps {
    const sorted = (): void => {
      this.syncHeader()
      this.refreshSubview()
      void this.persistFilter()
      after?.()
    }
    return {
      fields: sortFields(this.projectScope?.config),
      sort: this.sort,
      onChange: sorted,
      onReset: () => {
        this.sort.splice(0, this.sort.length, ...structuredClone(this.activeView()?.sort ?? makeDefaultSort()))
        sorted()
      }
    }
  }

  private openFields(anchor: HTMLElement): void {
    const props = this.fieldsProps()
    if (props) openFieldsPopover(anchor, props)
  }

  private fieldsProps(after?: () => void): FieldsPopoverProps | null {
    const scope = this.projectScope
    if (!scope) return null
    return {
      fields: this.fields,
      catalog: scope.fieldCatalog(),
      onChange: () => {
        this.handleFieldsChange()
        after?.()
      }
    }
  }

  /** The sort as the header names it, or nothing at the default. */
  private sortSummary(): SortSummary | undefined {
    return sameValue(this.sort, makeDefaultSort()) ? undefined : summarizeSort(sortFields(), this.sort)
  }

  /** How many default card fields are hidden, counted only once the board's fields were changed. */
  private hiddenFieldCount(): number {
    const scope = this.projectScope
    if (!scope || this.fields.kanban === undefined) return 0
    const catalog = scope.fieldCatalog()
    const shown = shownFields(this.fields, 'kanban', catalog)
    return shownFields({}, 'kanban', catalog).filter((id) => !shown.includes(id)).length
  }

  /** The query and option controls as the Tune button lists them in a narrow header. */
  private tuneItems(): TuneItem[][] {
    const scope = this.projectScope
    const primary = scope?.primary
    if (!scope || !primary) return []
    const filters = countActiveFilters(this.query.filter)
    const sort = this.sortSummary()
    const hidden = this.hiddenFieldCount()
    const query: TuneItem[] = [
      {
        icon: 'search',
        label: t('header.search'),
        state: this.query.text.trim(),
        onOpen: (anchor) => openSearchPopover(anchor, this.searchProps())
      },
      {
        icon: 'list-filter',
        label: t('header.filter'),
        state: filters ? String(filters) : '',
        onOpen: () => this.openFilter()
      }
    ]
    query.push(
      {
        icon: 'arrow-down-up',
        label: t('header.sort'),
        state: sort ? `${sort.label} ${sort.more}`.trim() : '',
        onOpen: (anchor) => this.openSort(anchor)
      },
      {
        icon: 'group',
        label: t('header.group'),
        state: this.groupSummary(),
        onOpen: (anchor) => this.openGroup(anchor)
      },
      {
        icon: 'columns-3',
        label: t('header.fields'),
        state: hidden ? tn('header.hiddenCount', hidden) : '',
        onOpen: (anchor) => this.openFields(anchor)
      }
    )
    return [query]
  }

  /** Rebuilds the board with the changed card fields. */
  private handleFieldsChange(): void {
    this.syncHeader()
    this.renderCurrentView()
    void this.persistFilter()
  }

  /** The board's field as the Group button names it, or nothing while the board groups by status untouched. */
  private groupSummary(): string {
    const setup = this.groupSetup()
    if (!setup) return ''
    const field = boardField(setup, this.group)
    const columns = this.group.columns?.[field]
    const changed =
      field !== makeDefaultGroup().field ||
      !!this.group.hideEmpty ||
      !!columns?.hidden?.length ||
      !!columns?.order?.length
    return changed ? filterFieldLabel(field, setup.ctx.customFields) : ''
  }

  private groupSetup() {
    const scope = this.projectScope
    return scope ? scope.filterSetup(this.query.filter, personKeyer(this.plugin.app)) : null
  }

  /** The board's columns as the Group popover lists them: every task the filter lets through. */
  private boardColumnsNow(): BoardColumn[] {
    const setup = this.groupSetup()
    const scope = this.projectScope
    if (!setup || !scope) return []
    const candidates = boardCandidates(scope.tasks())
    const shown = candidates.filter((task) => matchesQuery(task, this.query, setup.ctx))
    return boardColumns(setup, this.group, shown)
  }

  private openGroup(anchor: HTMLElement): void {
    const props = this.groupProps()
    if (props) openGroupPopover(anchor, props)
  }

  private groupProps(after?: () => void): GroupPopoverProps | null {
    const setup = this.groupSetup()
    if (!setup) return null
    return {
      fields: groupableFields(setup).map((id) => ({ id, label: filterFieldLabel(id, setup.ctx.customFields) })),
      group: this.group,
      field: () => boardField(setup, this.group),
      columns: () => this.boardColumnsNow(),
      onChange: () => {
        this.syncHeader()
        this.refreshSubview()
        void this.persistFilter()
        after?.()
      }
    }
  }

  /** The phone's sheet: Filter, Sort, Group and Fields, and how many tasks they leave. */
  private tuneSheet(): TuneSheetProps {
    const tabs: SheetTab[] = []
    const setup = this.filterSetup()
    if (setup) {
      tabs.push({
        id: 'filter',
        label: t('header.filter'),
        badge: () => countActiveFilters(this.query.filter),
        render: (parent, changed) =>
          renderFilterPanel(
            parent,
            setup,
            () => {
              this.handleFilterMutation()
              changed()
            },
            'list',
            { showClear: false }
          )
      })
    }
    tabs.push(
      {
        id: 'sort',
        label: t('header.sort'),
        render: (parent, changed) => renderSortPanel(parent, this.sortProps(changed))
      },
      {
        id: 'group',
        label: t('header.group'),
        render: (parent, changed) => {
          const props = this.groupProps(changed)
          if (props) renderGroupPanel(parent, props)
        }
      }
    )
    tabs.push({
      id: 'fields',
      label: t('header.fields'),
      render: (parent, changed) => {
        const props = this.fieldsProps(changed)
        if (props) renderFieldsPanel(parent, props)
      }
    })
    return {
      tabs,
      clear: {
        label: t('filter.clearAll'),
        canClear: () => countActiveFilters(this.query.filter) > 0,
        onClear: () => {
          this.query.filter.conditions = []
          this.query.filter.showArchived = false
          this.handleFilterMutation()
        }
      },
      doneLabel: () => tn('header.showTasks', this.taskCounts().shown)
    }
  }

  /** Keeps the project's overview reachable from the phone header. */
  private fillMoreMenu(menu: PlatformMenu): void {
    const scope = this.projectScope
    const primary = scope?.primary
    if (!primary || scope.isMulti) return
    menu.addItem((item) =>
      item
        .setTitle(t('project.openOverview'))
        .setIcon('gauge')
        .onClick(safeAsync(() => this.plugin.router.openProjectOverview(primary.filePath, this.leaf)))
    )
  }

  private renderActionsSlot(parent: HTMLElement): void {
    const add = new SplitButton(parent).setIcon('plus').setLabel(t('projectView.addTask'))
    add.onClick(() => this.addTask(add.el))
  }

  private filterSetup(): FilterSetup | null {
    const scope = this.projectScope
    if (!scope) return null
    const config = scope.config
    return {
      filter: this.query.filter,
      tasks: flattenTasks(scope.tasks()).map((flat) => flat.task),
      ctx: scope.filterContext(personKeyer(this.plugin.app)),
      priorities: config.priorities,
      priorityIcons: config.priorityIcons,
      projects: scope.isMulti
        ? scope.projects.map((project) => ({ id: project.id, title: project.title, color: project.color }))
        : []
    }
  }

  /** The applied filters under the header. A phone reaches them through the Tune sheet instead. */
  private renderFilterBar(): void {
    const header = this.header
    const setup = this.filterSetup()
    if (!header || !setup) return
    header.bar.empty()
    this.filterBar = null
    if (!this.queryBarOpen || Platform.isPhone) return
    const counts = this.taskCounts()
    this.filterBar = new FilterBar(header.bar, {
      ...setup,
      summary: t('header.shownSummary', { shown: counts.shown, total: counts.total }),
      onChange: () => this.handleFilterMutation(),
      onClose: () => {
        this.queryBarOpen = false
        this.renderFilterBar()
      }
    })
  }

  private handleFilterMutation(): void {
    this.syncHeader()
    void this.persistFilter()
    this.refreshSubview()
  }

  private handleSavedViewSelect(id: string | null): void {
    if (!this.projectScope) return
    if (id === null) {
      this.query.filter = makeDefaultFilter()
      this.activeSavedViewId = null
    } else {
      const sv = this.savedViews().find((v) => v.id === id)
      if (!sv) return
      this.applySavedView(sv)
    }
    this.queryBarOpen = countActiveFilters(this.query.filter) > 0
    void this.persistFilter()
    this.renderHeader()
    this.renderCurrentView()
  }

  private async handleSavedViewSave(name: string, isDefault: boolean): Promise<void> {
    if (!this.projectScope) return
    const sv: SavedView = {
      id: makeId(),
      name,
      filter: structuredClone(this.query.filter),
      sort: structuredClone(this.sort),
      group: structuredClone(this.group),
      fields: structuredClone(this.fields),
      viewMode: 'kanban',
      ...(isDefault ? { isDefault: true } : {})
    }
    this.activeSavedViewId = sv.id
    const views = isDefault ? withDefault(this.savedViews(), null) : this.savedViews()
    await this.persistSavedViews([...views, sv])
    void this.persistFilter()
    this.syncHeader()
  }

  private async handleSavedViewUpdate(id: string): Promise<void> {
    const views = this.savedViews()
    const sv = views.find((v) => v.id === id)
    if (!sv) return
    sv.filter = structuredClone(this.query.filter)
    sv.viewMode = 'kanban'
    sv.sort = structuredClone(this.sort)
    sv.group = structuredClone(this.group)
    sv.fields = structuredClone(this.fields)
    this.activeSavedViewId = sv.id
    await this.persistSavedViews(views)
    void this.persistFilter()
    this.syncHeader()
  }

  private async handleSavedViewDelete(id: string): Promise<void> {
    if (this.activeSavedViewId === id) this.activeSavedViewId = null
    await this.persistSavedViews(this.savedViews().filter((v) => v.id !== id))
    void this.persistFilter()
    this.syncHeader()
  }

  private async handleSavedViewRename(id: string, name: string): Promise<void> {
    const views = this.savedViews()
    const sv = views.find((v) => v.id === id)
    if (!sv) return
    sv.name = name
    await this.persistSavedViews(views)
    this.syncHeader()
  }

  private async handleSavedViewReorder(ids: string[]): Promise<void> {
    const byId = new Map(this.savedViews().map((view) => [view.id, view]))
    await this.persistSavedViews(ids.flatMap((id) => byId.get(id) ?? []))
  }

  /** One view per scope carries the star; starring another moves it. */
  private async handleSavedViewDefault(id: string | null): Promise<void> {
    await this.persistSavedViews(withDefault(this.savedViews(), id))
  }

  private refreshSubview(): void {
    this.subview?.render()
  }

  /** With several projects in view, a new task has to say which one it belongs to. */
  private addTask(anchor: HTMLElement): void {
    const scope = this.projectScope
    if (!scope?.primary) return
    const open = (project: Project): void => {
      openTaskModal(this.plugin, project, {
        onSave: async () => {
          await this.refreshProject()
        }
      })
    }
    if (!scope.isMulti) {
      open(scope.primary)
      return
    }
    const menu = new Menu()
    for (const project of scope.projects) {
      menu.addItem((item) =>
        item
          .setTitle(project.title)
          .setIcon('plus')
          .onClick(() => open(project))
      )
    }
    showMenuBelow(menu, anchor)
  }

  private renderCurrentView(): void {
    const scope = this.projectScope
    if (!scope?.primary) return

    this.subview?.destroy?.()
    this.bodyEl.empty()
    this.subview = new KanbanView(
      this.bodyEl,
      scope,
      this.plugin,
      () => this.refreshProject(),
      this.query,
      this.sort,
      this.group,
      this.fields,
      (anchor) => this.openGroup(anchor)
    )
    this.bodyEl.addClass('llk-content--kanban')
    this.subview.render()
  }

  /**
   * Re-render from the projects in memory. Coalesced, so a mutation reporting back
   * through both its own callback and the store's change event paints once.
   */
  refreshProject(): Promise<void> {
    if (this.pendingRefresh) return this.pendingRefresh
    this.pendingRefresh = new Promise((resolve) => {
      window.setTimeout(() => {
        this.pendingRefresh = null
        if (this.projectScope?.primary) {
          if (this.subview?.refresh) this.subview.refresh()
          else if (this.subview) this.subview.render()
          else this.renderCurrentView()
          this.syncHeader()
        }
        resolve()
      }, 0)
    })
    return this.pendingRefresh
  }
}
