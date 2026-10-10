# Low Level Kanban

在 Obsidian 中使用本地看板管理项目。项目和任务都是笔记仓库里的 Markdown 文件。

插件 ID 和代码仓库名称均为 `low-level-kanban`。这是 Obsidian 插件，不是独立的网页应用。

[English](README.md) | 简体中文

## 本地构建与安装

需要 Node.js 24 或更高版本、pnpm 11.5.3，以及 Obsidian 1.13.0 或更高版本。在代码仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm build
```

构建会在代码仓库根目录生成 `main.js` 和 `styles.css`，并在 `packages/viewer/dist/` 中构建 HTML 导出查看器。插件的 `manifest.json` 已包含在仓库中，构建不会生成或复制它。

试用修改后的构建前，请备份笔记仓库。插件会直接写入项目和任务笔记。如果已安装旧插件，请改按[从旧插件升级](#从旧插件升级)中的步骤操作。

1. 创建 `<vault>/.obsidian/plugins/low-level-kanban/` 目录。
2. 将 `main.js`、`styles.css`、`manifest.json` 和 `LICENSE` 复制到该目录。
3. 重新加载 Obsidian。
4. 在 **设置 > 第三方插件** 中启用 **Low Level Kanban**。

## 从旧插件升级

1. 备份笔记仓库，包括 `.obsidian` 目录。
2. 在 **设置 > 第三方插件** 中停用旧的 **dotpm** 插件，其插件 ID 为 `project-manager`。必须先停用旧插件，再启用 Low Level Kanban。
3. 创建 `<vault>/.obsidian/plugins/low-level-kanban/` 目录，并将新构建的 `main.js`、`styles.css`、`manifest.json` 和 `LICENSE` 复制进去。
4. 若要保留旧设置，仅在目标文件不存在时，将 `<vault>/.obsidian/plugins/project-manager/data.json` 复制到 `<vault>/.obsidian/plugins/low-level-kanban/data.json`。不要覆盖已有的 Low Level Kanban 设置。
5. 重新加载 Obsidian，然后启用 **Low Level Kanban**。保持旧插件停用。

旧快捷键可能需要重新分配。CSS 类名和自定义属性现在使用 `llk-` 前缀。如果自定义样式片段引用了旧的 `pm-` 类名或 `--pm-` 属性，请更新相应代码。

## 创建看板

1. 在命令面板运行 **Low Level Kanban: 打开项目面板**。
2. 选择 **新建项目** 并填写名称。
3. 打开项目，选择 **添加任务**。
4. 按需设置状态、优先级、负责人或截止日期。
5. 将卡片拖到另一状态列来修改任务状态。

项目直接以看板打开。使用看板控件筛选、排序、分组任务，选择卡片字段或隐藏列。看板可按状态、优先级、负责人、标签、类型或自定义字段分组。

每个任务保留 Markdown 正文、属性和链接。项目支持子任务、里程碑、自定义字段和保存的视图。默认情况下，新建项目会创建 `Projects/你的项目.md` 和 `Projects/你的项目_tasks/` 文件夹，任务笔记存放在该文件夹中。

要使用已有笔记，运行 **Low Level Kanban: 将笔记导入为任务**。TaskNotes 导入和状态配置共享方法见 [TaskNotes 使用说明](docs/tasknotes.md)。

## 导出离线看板

在项目菜单中选择 **将当前视图导出为 HTML**，即可在项目笔记旁保存只读看板。文件包含任务数据、样式和查看器，无需服务器或网络连接即可在浏览器中打开。

导出保留任务日期、依赖关系、层级、自定义字段、人员颜色，以及看板的筛选、排序、分组和隐藏列设置。使用此查看器加载旧版快照时，内容也以看板展示。

## 本地开发

要在代码或样式变化时重新构建，运行：

```sh
pnpm dev
```

默认输出位置是代码仓库根目录。要直接将 `main.js` 和 `styles.css` 写入测试用笔记仓库，先创建 `<vault>/.obsidian/plugins/low-level-kanban/` 目录，并将 `manifest.json` 和 `LICENSE` 复制进去，然后运行：

```sh
env VAULT_PATH="/absolute/path/to/test-vault" pnpm dev
```

`VAULT_PATH` 指向笔记仓库根目录，不是插件目录。重新构建后，在 Obsidian 中重新加载插件。查看器只在命令启动时构建，修改查看器代码后需重新运行命令。修改 `manifest.json` 后也需重新复制该文件。

使用修改后的构建前，运行本地检查：

```sh
pnpm check
pnpm check:submission
pnpm test
pnpm build
```

## 许可证

[MIT](LICENSE)。分发插件副本时，请保留版权声明和许可证。
