# Fluent OneNote - Architecture & Developer Guide

<context>
This document defines the core architecture, data flow, component boundaries, system invariants, and API contracts for AI agents and human developers contributing to Fluent OneNote ("vibe coding"). For public usage and user installation, refer to: [README.md](file:///C:/ObsidianPublish/fluent-onenote/README.md).
</context>

## Architectural Overview

Fluent OneNote provides a 2-Pane / 3-Pane navigation layout (Notebooks -> Sections -> Pages) for Obsidian notes, available as both a floating popup modal (`Ctrl+Shift+O`) and a persistent sidebar tab view.

```
+------------------------------------------------------------------------------------+
|                                Obsidian Workspace                                  |
|                                                                                    |
|  +---------------------------+                     +----------------------------+  |
|  |  OneNoteViewWrapper       |  [Command / Hotkey] |  OneNoteModal (Popup Controller)
|  |   (VIEW_TYPE_SECTIONS)    | ------------------->|  (Floating 65vw x 70vh Modal) |  |
|  |   [Mounted Svelte View]   |                     |   [Mounted Svelte View]    |  |
|  +-------------+-------------+                     +--------------+-------------+  |
+----------------|--------------------------------------------------|----------------+
                 |                                                  |
                 +----------------- DataService Facade --------------+
                                           |
                                   VaultScanner Engine
                                           |
                           Obsidian Vault File Tree API
```

<data_flow>
Data propagation from Obsidian's file system changes to UI rendering follows an 8-step sequence:

1. **FileSystem Event**: User modifies folders/files or creates/deletes notes in the vault.
2. **Scanner Invocation**: Svelte view receives vault change event -> calls `DataService.getNotebooks(rootFolder, customNotebookOrder, customSectionOrderMap, customPageOrder)`.
3. **3-Tier Parsing**: `VaultScanner.scanNotebooks()` parses 3 hierarchical levels:
   - Level 1: Top folders under `rootFolder` -> `NotebookInfo[]` (1-level flat).
   - Level 2: Sub-folders inside Notebook -> `SectionInfo[]` (1-level flat).
   - Level 3: Files & sub-folders inside Section -> `PageInfo[]` (multi-level nested sub-pages).
4. **Custom Order Sorting**: `DataService` applies `customNotebookOrder`, `customSectionOrderMap[notebookPath]`, and `customPageOrder[sectionPath]` maps.
5. **State Dispatch**: `OneNoteView` or `OneNoteModalView` updates `notebooks`, `selectedNotebook`, `sections`, and `selectedSection`.
6. **Optimistic UI & Deferred Drag Cleanup**: Drag and drop events reorder Svelte arrays synchronously for 0ms visual feedback, deferring state clearing by 50ms (`setTimeout`) to prevent `on:dragend` race conditions.
7. **Active Highlight**: Workspace `file-open` event is captured by the Svelte layout to highlight active `filepath`.
8. **Modal Self-Termination**: Clicking a page inside `OneNoteModalView` triggers `openPage()`, which calls `onPageOpened()` callback to dismiss the parent `OneNoteModal` popup.
</data_flow>

## Component Scope & Ownership

<scope_boundaries>
| Component | Primary Responsibility | MUST NOT Contain |
| :--- | :--- | :--- |
| `src/main.ts` | Plugin lifecycle, registering ItemViews, commands, settings tab | Direct DOM manipulations, raw vault file scanning |
| `VaultScanner` | Traversing vault directories, parsing Notebooks, Sections, and Pages | Svelte framework state, DOM actions, workspace leaf tracking |
| `DataService` | Decoupling scanner execution, sorting custom orders, flattening page trees | Direct file parsing or UI rendering logic |
| `DragDropHelper` | Reordering Notebooks/Sections/Pages, executing `renameFile` for cross-pane moves | Svelte state mutation or direct DOM rendering |
| `OneNoteView` | 3-pane sidebar layout (`Notebooks -> Sections -> Pages`), active leaf detection | Directly scanning directory files or interacting with adapter |
| `OneNoteModal` | Instantiating popup container, setting dimensions, applying modal styles | Direct database query or file system interaction |
| `OneNoteModalView` | Displaying 3-pane popup layout, Quick Switcher search, managing keyboard navigation | Accessing settings parameters directly or saving configuration file |
| `NotebookTreeItem` | Displaying 1-level flat notebook cards in Pane 1 | Managing section lists or file deletion |
| `SectionTreeItem` | Displaying 1-level flat section cards in Pane 2 | Managing sub-sections or page lists |
| `PageTreeItem` | Recursive sub-page rendering in Pane 3, title click handling, expansion chevron toggle | File system mutation or direct vault deletion logic |
</scope_boundaries>

## System Invariants & Rules

<key_invariants>
- **Synchronous Settings Tab Registration**: MUST call `this.addSettingTab(new FluentOneNoteSettingTab(...))` synchronously in `onload()` before awaiting any async setup. (Why: prevents monkey-patched settings managers like 'settings-in-tab' from failing to intercept the gear icon).
- **No Leaf Detaching in `onunload()`**: NEVER call `app.workspace.detachLeavesOfType()` inside `onunload()`. (Why: resets user's custom layout positions on plugin reload).
- **3-Pane Hierarchy**: Notebooks (1-level flat) -> Sections (1-level flat) -> Pages (multi-level sub-pages).
- **Sibling-Only Page Drag**: Reordering pages within Pane 3 is enforced among sibling items only; cross-level attempts trigger a Notice toast.
- **Deferred Drag Cleanup**: `handleDragEnd` cleanup is deferred by 50ms (`setTimeout`) to guarantee `handleDrop` consumes state before reset.
- **File Deletion API**: MUST use `app.fileManager.trashFile(file)` instead of `app.vault.trash(file)`. (Why: respects user's configured trash preferences).
- **Static CSS Styling**: NEVER inject dynamic `<style>` DOM tags at runtime. Use `document.body.setCssProps()` for dynamic theme variables. (Why: strictly required by Obsidian Community Store automated checks).
- **Type-Safe Folder Inspection**: MUST use `if (!(folder instanceof TFolder))` runtime checks instead of `(folder as TFolder)` casting. (Why: prevents runtime type assertion errors).
</key_invariants>

## Key API Reference

<api_reference>
| Class / Module | Method | Signature | Side-Effects |
| :--- | :--- | :--- | :--- |
| `VaultScanner` | `scanNotebooks` | `(rootFolder: string): NotebookInfo[]` | Read-only 3-tier directory parse. |
| `DataService` | `getNotebooks` | `(rootFolder, notebookOrder, sectionMap, pageMap): NotebookInfo[]` | Queries scanner and applies custom sorting maps. |
| `DragDropHelper` | `reorderNotebook` | `(settings, save, source, target, pos, allNotebooks)` | Saves `settings.customNotebookOrder`. |
| `DragDropHelper` | `reorderSection` | `(settings, save, source, target, pos, sections, notebookPath)` | Saves `settings.customSectionOrderMap[notebookPath]`. |
| `DragDropHelper` | `reorderPage` | `(settings, save, source, target, pos, pages, sectionPath)` | Saves `settings.customPageOrder[sectionPath]`. |
| `DragDropHelper` | `movePageToSection` | `(app, page, targetFolderPath)` | Moves `TFile` or `TFolder` using `app.fileManager.renameFile`. |
| `DataService` | `getFlattenedPages` | `(pages: PageInfo[]): PageInfo[]` | Pure tree flattening query. Returns 1D DOM layout list. |
| `AtomicIOPipeline` | `processFile` | `(filepath: string, mutator: (data: string) => string) => Promise<void>` | Atomically updates file via `app.vault.process`. |
</api_reference>

## Development Recipes for Contributors

<adding_new_setting_recipe>
To add a new configurable setting property:

1. Open `src/types.ts` and add property to `FluentOneNoteSettings` interface.
2. Open `src/settings.ts` and add default mapping to `DEFAULT_SETTINGS`.
3. Open `src/settings.ts` inside `display()`, use `new Setting(containerEl)` to append a toggle, slider, or dropdown:
```typescript
new Setting(containerEl)
    .setName("My New Feature")
    .setDesc("Description of feature.")
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.myNewFeature)
        .onChange(async (value) => {
            this.plugin.settings.myNewFeature = value;
            await this.plugin.saveSettings();
        }));
```
</adding_new_setting_recipe>

<adding_new_command_recipe>
To add a new command to the Obsidian Command Palette (`Ctrl+P`):

1. Open `src/main.ts`.
2. Inside `onload()`, append a command block:
```typescript
this.addCommand({
    id: "my-command-id", // Do NOT prefix with plugin ID; Obsidian handles scoping
    name: "My Command Display Name", // Do NOT include "Fluent OneNote:" in the name
    callback: () => {
        void this.myCommandImplementation();
    },
});
```
</adding_new_command_recipe>

## Troubleshooting & Common Edge Cases

<troubleshooting>
- **Zombie CSS Cache**: After editing CSS, verify that `styles.css` in the plugin root matches `main.css` in size. (Obsidian loads `styles.css` from the plugin root).
- **Leaf Reveal**: Use `workspace.revealLeaf(leaf)` natively without `(workspace as any)`.
- **File Deletion**: Always use `app.fileManager.trashFile(file)` instead of `app.vault.trash()`.
</troubleshooting>
