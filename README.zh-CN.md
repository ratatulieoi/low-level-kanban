# Low Level Kanban

在 Obsidian 中使用本地看板管理项目。项目和任务都是笔记仓库里的 Markdown 文件。

本插件是 [dotpm](https://github.com/dotpm/obsidian-pm) 的分支（Fork）。插件 ID 和代码仓库名称均为 `low-level-kanban`。

[English](README.md) | 简体中文

## 功能特性

- **仓库原生**：项目和任务以带有 YAML frontmatter 的标准 Markdown 笔记形式直接存放在笔记仓库中。
- **看板视图**：在状态列之间拖拽卡片或在列内重新排序。支持按状态、优先级、负责人、标签、类型或自定义字段分组。
- **任务编辑**：通过行内控件直接编辑属性。点击日期字段直接呼出系统原生日期选择器。
- **自定义标签颜色**：在任务编辑器中点击标签胶囊，即可选择调色板预设或自定义十六进制颜色。颜色会同步应用至标签圆点和边框。
- **子任务管理**：添加子任务并跟踪进度。已完成的子任务会自动沉底，便于查看未完成事项。
- **卡片字段控制**：自定义卡片显示字段，悬停在卡片标题上可查看创建日期，悬停在截止日期上可查看剩余天数。
- **离线导出**：将只读看板导出为独立的 HTML 文件，内置离线查看器，无需服务器即可在浏览器中打开。

## 本地构建与安装

需要 Node.js 24 或更高版本、pnpm 11.5.3，以及 Obsidian 1.13.0 或更高版本。在代码仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm build
```

构建会在代码仓库根目录生成 `main.js` 和 `styles.css`，并在 `packages/viewer/dist/` 中构建 HTML 导出查看器。

1. 创建 `<vault>/.obsidian/plugins/low-level-kanban/` 目录。
2. 将 `main.js`、`styles.css`、`manifest.json` 和 `LICENSE` 复制到该目录。
3. 重新加载 Obsidian。
4. 在 **设置 > 第三方插件** 中启用 **Low Level Kanban**。

## 创建看板

1. 在命令面板运行 **Low Level Kanban: 打开项目面板**。
2. 选择 **新建项目** 并填写名称。
3. 打开项目，选择 **添加任务**。
4. 按需设置状态、优先级、负责人或截止日期。
5. 将卡片拖到另一状态列来修改任务状态。

项目直接以看板打开。使用看板控件筛选、排序、分组任务，选择卡片字段或隐藏列。

每个任务保留 Markdown 正文、属性和链接。项目支持子任务、里程碑、自定义字段和保存的视图。默认情况下，新建项目会创建 `Projects/你的项目.md` 和 `Projects/你的项目_tasks/` 文件夹，任务笔记存放在该文件夹中。

要使用已有笔记，运行 **Low Level Kanban: 将笔记导入为任务**。TaskNotes 导入和状态配置共享方法见 [TaskNotes 使用说明](docs/tasknotes.md)。

## 导出离线看板

在项目菜单中选择 **将当前视图导出为 HTML**，即可在项目笔记旁保存只读看板。文件包含任务数据、样式和查看器，无需服务器或网络连接即可在浏览器中打开。

导出保留任务日期、依赖关系、层级、自定义字段、人员颜色，以及看板的筛选、排序、分组和隐藏列设置。

## 本地开发

要在代码或样式变化时重新构建，运行：

```sh
pnpm dev
```

默认输出位置是代码仓库根目录。要直接将 `main.js` 和 `styles.css` 写入测试用笔记仓库，先创建 `<vault>/.obsidian/plugins/low-level-kanban/` 目录，并将 `manifest.json` 和 `LICENSE` 复制进去，然后运行：

```sh
env VAULT_PATH="/absolute/path/to/test-vault" pnpm dev
```

`VAULT_PATH` 指向笔记仓库根目录，不是插件目录。重新构建后，在 Obsidian 中重新加载插件。

使用修改后的构建前，运行本地检查：

```sh
pnpm check
pnpm check:submission
pnpm test
pnpm build
```

## 许可证

[MIT](LICENSE)。分发插件副本时，请保留版权声明和许可证。
