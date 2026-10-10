# Low Level Kanban

Local Kanban boards for Obsidian. Projects and tasks are Markdown notes in your vault.

This plugin is a fork of [dotpm](https://github.com/dotpm/obsidian-pm). The plugin ID and repository name are `low-level-kanban`.

English | [简体中文](README.zh-CN.md)

## Features

- **Vault-native**: Projects and tasks are standard Markdown notes stored directly in your vault with YAML frontmatter.
- **Kanban boards**: Drag and drop cards between status columns or reorder them within a column. Group cards by status, priority, assignee, tag, type, or custom field.
- **Task editor**: Edit properties directly with inline controls. Date fields spawn the native calendar picker directly on click.
- **Custom tag colors**: Click any tag chip in the task editor to pick a preset swatch or custom hex color. Colors apply to tag dots and borders across cards and views.
- **Subtask management**: Add subtasks with progress tracking. Completed subtasks automatically move below unfinished subtasks.
- **Card detail controls**: Toggle card fields, inspect created dates by hovering over card titles, and view days remaining on hover over due dates.
- **Offline export**: Export read-only boards to standalone HTML files with an embedded offline viewer that runs without a server.

## Build and install locally

Use Node.js 24 or newer, pnpm 11.5.3, and Obsidian 1.13.0 or newer. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The build writes `main.js` and `styles.css` to the repository root. It also builds the HTML export viewer in `packages/viewer/dist/`.

1. Create `<vault>/.obsidian/plugins/low-level-kanban/`.
2. Copy `main.js`, `styles.css`, `manifest.json`, and `LICENSE` into that directory.
3. Reload Obsidian.
4. Enable **Low Level Kanban** under **Settings > Community plugins**.

## Create a board

1. Run **Low Level Kanban: Open projects pane** from the command palette.
2. Select **New project** and give it a name.
3. Open the project and select **Add task**.
4. Set a status, priority, assignee, or due date as needed.
5. Drag cards between status columns to change their status.

Projects open as Kanban boards. Use the board controls to filter, sort, group tasks, choose card fields, or hide columns.

Each task keeps its Markdown body, properties, and links. Projects can contain subtasks, milestones, custom fields, and saved views. By default, a new project creates `Projects/Your project.md` and a `Projects/Your project_tasks/` folder containing its task notes.

To use existing notes, run **Low Level Kanban: Import notes as tasks**. For TaskNotes imports and shared status palettes, see [Use with TaskNotes](docs/tasknotes.md).

## Export an offline board

Use **Export current view as HTML** from the project menu to save a read-only board beside the project note. The file contains its task data, styles, and viewer, opening in any browser without a server or network connection.

Exports preserve task dates, dependencies, hierarchy, custom fields, person colors, and the board's filter, sort, grouping, and hidden columns.

## Develop locally

To rebuild JavaScript and styles on changes, run:

```sh
pnpm dev
```

By default, this writes `main.js` and `styles.css` to the repository root. To write them directly into a test vault, first create `<vault>/.obsidian/plugins/low-level-kanban/` and copy `manifest.json` and `LICENSE` into it. Then run:

```sh
env VAULT_PATH="/absolute/path/to/test-vault" pnpm dev
```

`VAULT_PATH` points to the vault root, not the plugin directory. Reload the plugin in Obsidian after a rebuild.

Run the local checks before committing changes:

```sh
pnpm check
pnpm check:submission
pnpm test
pnpm build
```

## License

[MIT](LICENSE). Keep the copyright notice and license with copies of the plugin.
