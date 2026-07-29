# A1 OneNote - Internal Architecture & Core Dev

This document details the internal components, data flows, and constraints of the A1 OneNote navigation plugin.

---

<data_flow>
## Data Flow
The sequence of data propagation from Obsidian's file system changes to UI rendering:

1. **FileSystem Event**: User modifies folders/files in the vault.
2. **Scanner Invocation**: Svelte view receives event -> calls `DataService.getNotebooks(rootFolder, customNotebookOrder, customSectionOrderMap, customPageOrder)`.
3. **3-Tier Parsing**: `VaultScanner.scanNotebooks()` parses 3 levels:
   - Level 1: Top folders under `rootFolder` -> `NotebookInfo[]` (1-level flat).
   - Level 2: Sub-folders inside Notebook -> `SectionInfo[]` (1-level flat).
   - Level 3: Files & sub-folders inside Section -> `PageInfo[]` (multi-level nested sub-pages).
4. **Custom Order Sorting**: `DataService` applies `customNotebookOrder`, `customSectionOrderMap[notebookPath]`, and `customPageOrder[sectionPath]` maps.
5. **State Dispatch**: `OneNoteView` or `OneNoteModalView` updates `notebooks`, `selectedNotebook`, `sections`, and `selectedSection`.
6. **Optimistic UI & Deferred Drag Cleanup**: Drag and drop events reorder Svelte arrays synchronously for 0ms visual feedback, deferring state clearing by 50ms (`setTimeout`) to prevent `on:dragend` race conditions.
7. **Active Highlight**: Workspace `file-open` event is captured by the Svelte layout to highlight active `filepath`.
8. **Modal Self-Termination**: Clicking a page inside `OneNoteModalView` triggers `openPage()`, which calls `onPageOpened()` callback to dismiss the parent `OneNoteModal` popup.
</data_flow>

---

## Component Boundaries

The project enforces strict boundaries between scanning logic, modal popup controller, and Svelte DOM presentation.

| Component | Responsible For | MUST NOT Contain |
| :--- | :--- | :--- |
| `VaultScanner` | Traversing vault directories, parsing Notebooks, Sections, and Pages. | Svelte framework state, DOM actions, workspace leaf tracking. |
| `DataService` | Decoupling scanner execution, sorting custom orders, flattening page trees. | Direct file parsing or UI logic processing. |
| `DragDropHelper` | Reordering Notebooks/Sections/Pages in settings, executing `renameFile` for cross-pane moves. | Svelte state mutation or direct DOM rendering. |
| `OneNoteView` | 3-pane sidebar layout (`Notebooks -> Sections -> Pages`), active leaf detection. | Directly scanning directory files or interacting with adapter. |
| `OneNoteModal` | Instantiating popup container, setting dimensions, applying modal styles. | Direct database query or file system interaction. |
| `OneNoteModalView` | Displaying 3-pane popup layout, Quick Switcher search, managing keyboard navigation. | Accessing settings parameters directly or saving configuration file. |
| `NotebookTreeItem` | Displaying 1-level flat notebook cards in Pane 1. | Managing section lists or file deletion. |
| `SectionTreeItem` | Displaying 1-level flat section cards in Pane 2. | Managing sub-sections or page lists. |
| `PageTreeItem` | Recursive sub-page rendering in Pane 3, title click handling, expansion chevron toggle. | File system mutation or direct vault deletion logic. |

---

## API Reference & Side-Effects

| Method | Signature | Side-Effects |
| :--- | :--- | :--- |
| `scanNotebooks` | `scanNotebooks(rootFolder: string): NotebookInfo[]` | Read-only 3-tier directory parse. |
| `getNotebooks` | `getNotebooks(rootFolder, notebookOrder, sectionMap, pageMap): NotebookInfo[]` | Queries scanner and applies custom sorting maps. |
| `reorderNotebook` | `reorderNotebook(settings, save, source, target, pos, allNotebooks)` | Saves `settings.customNotebookOrder`. |
| `reorderSection` | `reorderSection(settings, save, source, target, pos, sections, notebookPath)` | Saves `settings.customSectionOrderMap[notebookPath]`. |
| `reorderPage` | `reorderPage(settings, save, source, target, pos, pages, sectionPath)` | Saves `settings.customPageOrder[sectionPath]`. |
| `movePageToSection` | `movePageToSection(app, page, targetFolderPath)` | Moves `TFile` or `TFolder` using `app.fileManager.renameFile`. |
| `getFlattenedPages` | `getFlattenedPages(pages: PageInfo[]): PageInfo[]` | Pure tree flattening query. Returns 1D DOM layout list. |

---

<adding_new_setting_recipe>
## Recipe: How to add a new Setting
To add a new configurable property:
1. **Define setting type**: Open [types.ts](file:///C:/ObsidianDev/plugins/A1OneNote/src/types.ts) and add property to `A1OneNoteSettings`.
2. **Set default value**: Open [settings.ts](file:///C:/ObsidianDev/plugins/A1OneNote/src/settings.ts) and add default mapping to `DEFAULT_SETTINGS`.
3. **Register input box**: Open [settings.ts](file:///C:/ObsidianDev/plugins/A1OneNote/src/settings.ts) inside `display()`, use `new Setting(containerEl)` to append a toggle or dropdown, writing output to `this.plugin.settings.myProperty` and calling `await this.plugin.saveSettings()`.
</adding_new_setting_recipe>

---

## System Invariants

1. **3-Pane Hierarchy**: Notebooks (1-level flat) -> Sections (1-level flat) -> Pages (multi-level sub-pages).
2. **Sibling-Only Page Drag**: Reordering pages within Pane 3 is enforced among sibling items only; cross-level attempts trigger a Notice toast.
3. **Deferred Drag Cleanup**: `handleDragEnd` cleanup is deferred by 50ms (`setTimeout`) to guarantee `handleDrop` consumes state before reset.
4. **Synchronous settings tab load**: `onload()` must register the settings tab before any layout awaits.
5. **Popup Automatic Close**: The navigation popup Modal must close immediately after a file is selected and opened.
