# Low Level Kanban

Local Kanban boards for Obsidian. Projects and tasks are Markdown notes in your vault.

The plugin ID and repository name are `low-level-kanban`. This is an Obsidian plugin, not a standalone web app.

English | [简体中文](README.zh-CN.md)

## Build and install locally

Use Node.js 24 or newer, pnpm 11.5.3, and Obsidian 1.13.0 or newer. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The build writes `main.js` and `styles.css` to the repository root. It also builds the HTML export viewer in `packages/viewer/dist/`. The plugin's `manifest.json` is already in the repository; the build does not generate or copy it.

Back up the vault before trying a modified build. The plugin writes project and task notes directly into the vault. If you have the old plugin installed, follow [Upgrade from the old plugin](#upgrade-from-the-old-plugin) instead.

1. Create `<vault>/.obsidian/plugins/low-level-kanban/`.
2. Copy `main.js`, `styles.css`, `manifest.json`, and `LICENSE` into that directory.
3. Reload Obsidian.
4. Enable **Low Level Kanban** under **Settings > Community plugins**.

## Upgrade from the old plugin

1. Back up the vault, including its `.obsidian` directory.
2. Disable **dotpm**, plugin ID `project-manager`, under **Settings > Community plugins** before enabling Low Level Kanban.
3. Create `<vault>/.obsidian/plugins/low-level-kanban/` and copy the new build's `main.js`, `styles.css`, `manifest.json`, and `LICENSE` into it.
4. To keep your old settings, copy `<vault>/.obsidian/plugins/project-manager/data.json` to `<vault>/.obsidian/plugins/low-level-kanban/data.json` only if the destination does not exist. Do not overwrite existing Low Level Kanban settings.
5. Reload Obsidian and enable **Low Level Kanban**. Keep the old plugin disabled.

Old hotkeys may need reassignment. CSS classes and custom properties now use the `llk-` prefix. Update custom snippets that target old `pm-` classes or `--pm-` properties.

## Create a board

1. Run **Low Level Kanban: Open projects pane** from the command palette.
2. Select **New project** and give it a name.
3. Open the project and select **Add task**.
4. Set a status, priority, assignee, or due date as needed.
5. Drag a card between status columns to change its status.

Projects open as Kanban boards. Use the board controls to filter, sort, group tasks, choose card fields, or hide columns. Columns can group tasks by status, priority, assignee, tag, type, or a custom field.

Each task keeps its Markdown body, properties, and links. Projects can contain subtasks, milestones, custom fields, and saved views. By default, a new project creates `Projects/Your project.md` and a `Projects/Your project_tasks/` folder containing its task notes.

To use existing notes, run **Low Level Kanban: Import notes as tasks**. For TaskNotes imports and shared status palettes, see [Use with TaskNotes](docs/tasknotes.md).

## Export an offline board

Use **Export current view as HTML** from the project's menu to save a read-only board beside the project note. The file contains its task data, styles, and viewer, so it opens in a browser without a server or network connection.

Exports keep task dates, dependencies, hierarchy, custom fields, person colors, and the board's filter, sort, grouping, and hidden columns. Older snapshot files open as Kanban boards when loaded with this viewer.

## Develop locally

To rebuild JavaScript and styles on changes, run:

```sh
pnpm dev
```

By default, this writes `main.js` and `styles.css` to the repository root. To write them directly into a test vault, first create `<vault>/.obsidian/plugins/low-level-kanban/` and copy `manifest.json` and `LICENSE` into it. Then run:

```sh
env VAULT_PATH="/absolute/path/to/test-vault" pnpm dev
```

`VAULT_PATH` points to the vault root, not the plugin directory. Reload the plugin in Obsidian after a rebuild. The viewer builds when the command starts; rerun it after changing viewer code. Copy `manifest.json` again if you change it.

Run the local checks before using a changed build:

```sh
pnpm check
pnpm check:submission
pnpm test
pnpm build
```

## License

[MIT](LICENSE). Keep the copyright notice and license with copies of the plugin.
