# Fluent OneNote - Architecture & Developer Guide

<context>
This document defines the core architecture, data flow, component boundaries, system invariants, and API contracts for Fluent OneNote. For public usage and user installation, refer to: [README.md](file:///C:/ObsidianPublish/fluent-onenote/README.md).
</context>

## Architectural Overview

Fluent OneNote provides a 2-Pane navigation layout (Notebooks -> Sections -> Pages) for Obsidian notes, available as both a floating popup modal (`Ctrl+Shift+O`) and a persistent sidebar tab view.

```
+------------------------------------------------------------------------------------+
|                                Obsidian Workspace                                  |
|                                                                                    |
|  +---------------------------+                     +----------------------------+  |
|  |  OneNoteViewWrapper       |  [Command / Hotkey] |  OneNoteModal (Popup Controller)
|  |   (VIEW_TYPE_SECTIONS)    | ------------------->|  (Floating Custom Size Modal) |
|  |   [Mounted Svelte View]   |                     |   [Mounted Svelte View]    |  |
|  +-------------+-------------+                     +--------------+-------------+  |
+----------------|--------------------------------------------------|----------------+
                 |                                                  |
                 +----------------- OneNoteViewModel ---------------+
                                            |
                                    DataService Facade
                                            |
                                    VaultScanner Engine
                                            |
                            Obsidian Vault File Tree API
```

<data_flow>
## Data Flow Sequence
Data propagation from Obsidian's file system changes to UI rendering follows a strict sequence:

1. **FileSystem Event**: User creates, renames, deletes, or moves folders/files in the vault.
2. **Scanner Invocation**: Svelte view receives event or order change -> invokes `DataService.getNotebooks(rootFolder, customNotebookOrder, customSectionOrderMap, customPageOrder)`.
3. **3-Tier Directory Parsing**: `VaultScanner.scanNotebooks()` parses 3 hierarchical levels:
   - Level 1: Top folders under `rootFolder` -> `NotebookInfo[]` (1-level flat).
   - Level 2: Sub-folders inside Notebook -> `SectionInfo[]` (1-level flat).
   - Level 3: Files & sub-folders inside Section -> `PageInfo[]` (multi-level nested sub-pages).
4. **Custom Order Sorting**: `DataService` applies `customNotebookOrder`, `customSectionOrderMap[notebookPath]`, and `customPageOrder[sectionPath]` mappings.
5. **ViewModel State Dispatch**: `OneNoteViewModel` throttles updates and dispatches stores: `notebooks`, `selectedNotebook`, `sections`, `selectedSection`, `searchAllNotebooks`, `filteredPages`.
   - **Scoped Search Filtering**: In Single-Notebook mode (`!$searchAllNotebooks`), `filteredPages` derives recursively from active `$sections` only. In Global mode (`$searchAllNotebooks`), `filteredPages` traverses all `$notebooks` and nested sub-pages, injecting `${notebookName} / ${sectionName}` badge paths.
6. **Optimistic Drag & Drop UI**:
   - `handleDragStart`: Sets dragged item, adds `is-dragging-active` to `document.body` (shielding child pointer-events).
   - `handleDragOver`: Runs 60px linear-damping rAF auto-scroller and throttles store updates (dispatches only on target/position change).
   - `handleDragLeave`: Safely clears indicator lines when cursor leaves item.
   - `handleDrop`: Synchronously reorders in-memory arrays for 0ms visual feedback, stops auto-scroll, removes body shield, and saves custom ordering asynchronously.
7. **Active Highlight**: Workspace `file-open` event triggers `activePagePath` store update to highlight current note.
8. **EventBus Pub/Sub**: `EventBus.emit(EventName.ORDER_CHANGED)` broadcasts order resets and imports across all open views without requiring plugin reload.
9. **Modal Self-Termination**: Clicking a page in `OneNoteModalView` triggers `openPage()` and dismisses the parent `OneNoteModal`.
</data_flow>

## Component Scope & Ownership

<scope_boundaries>
| Component | Primary Responsibility | MUST NOT Contain |
| :--- | :--- | :--- |
| `src/main.ts` | Plugin lifecycle, registering ItemViews, commands, settings tab, recent pages tracker | Direct DOM manipulation, raw vault file scanning |
| `OneNoteViewModel` | Centralized UI state store, rAF auto-scroller, throttled DnD coordination, keyboard focus | Direct file system mutation or raw HTML formatting |
| `VaultScanner` | Traversing vault directories, parsing Notebooks, Sections, and Pages | Svelte framework state, DOM actions, workspace leaf tracking |
| `DataService` | Decoupling scanner execution, sorting custom orders, flattening page trees | Direct file parsing or UI rendering logic |
| `DragDropHelper` | Reordering Notebooks/Sections/Pages, executing `renameFile` for cross-pane moves | Svelte state mutation or direct DOM rendering |
| `EventBus` | Singleton pub/sub bus for cross-pane and cross-modal event communication | State persistence or business logic |
| `OneNoteView` | Persistent sidebar tab view (`Notebooks -> Sections -> Pages`), active leaf detection | Directly scanning directory files or raw disk writes |
| `OneNoteModal` | Instantiating popup container, setting dimensions, applying modal styles | Direct database query or file system interaction |
| `OneNoteModalView` | Floating popup layout, IME-safe search, keyboard navigation, dropdown notebook popover | Direct settings persistence or raw vault scanning |
| `RecentPagesModal` | Fuzzy-search modal for recently visited pages sorted by access timestamp | Modifying file contents or tree hierarchies |
| `ConfirmModal` | Reusable modal for destructive confirmation dialogs (e.g. order reset) | Arbitrary business mutations outside callback |
| `NotebookTreeItem` | Displaying 1-level flat notebook cards in dropdown popover | Managing section lists or file deletion |
| `SectionTreeItem` | Displaying 1-level flat section cards in Section pane | Managing sub-sections or page lists |
| `PageTreeItem` | Recursive sub-page rendering in Pages pane, click handling, chevron toggle | File system mutation or direct vault deletion logic |
</scope_boundaries>

## System Invariants & Rules

<key_invariants>
- **Synchronous Settings Tab Registration**: MUST call `this.addSettingTab(new FluentOneNoteSettingTab(...))` synchronously in `onload()` before awaiting any async setup. (Why: prevents monkey-patched settings managers like 'settings-in-tab' from failing to intercept the gear icon).
- **No Leaf Detaching in `onunload()`**: NEVER call `app.workspace.detachLeavesOfType()` inside `onunload()`. (Why: resets user's custom layout positions on plugin reload).
- **IME Composition Guard**: In modal search inputs, hotkey handlers MUST check `if (e.isComposing || e.keyCode === 229) return;` before processing `Enter`, `Space`, or arrow keys. (Why: prevents dropping the first character or prematurely submitting candidate selections in Asian IMEs).
- **Search Scope Isolation**: Single-Notebook search MUST strictly query `$sections` under `$selectedNotebook` with local section badges; Global Search MUST traverse `$notebooks` and render compound `${notebook} / ${section}` badges. (Why: guarantees user predictability across large multi-notebook vaults).
- **DragOver Throttling**: DragOver handlers MUST NOT dispatch Svelte store updates unless `itemId` or `position` actually changed. (Why: uncapped 60Hz store updates cause severe reactivity thrashing across large note trees).
- **60px rAF Auto-Scroll**: Edge auto-scrolling MUST use `requestAnimationFrame` with linear damping within a 60px boundary and `scroll-behavior: auto !important;` on `.on-list`. (Why: provides smooth, predictable scrolling without jerky jumps).
- **Child Pointer Events Shield**: Active dragging MUST toggle `is-dragging-active` on `document.body` with `pointer-events: none !important;` on all child elements. (Why: prevents cursor coordinate jitter when hovering over icons, chevrons, and text labels).
- **Sibling-Only Page Drag**: Reordering pages within the Pages pane is enforced among sibling items only; cross-level attempts trigger a Notice toast. (Why: prevents tree structural corruption).
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
| `OneNoteViewModel` | `handleDragOver` | `(e: DragEvent, itemId: string, itemType: string)` | Runs rAF auto-scroll and updates throttled stores. |
| `OneNoteViewModel` | `handleDrop` | `(e: DragEvent, targetId: string, targetType: string)` | Synchronously reorders Svelte arrays and persists order. |
| `EventBus` | `emit` | `(event: EventName, payload?: any): void` | Broadcasts event to all registered listeners. |
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
- **Asian IME Glitches**: Always verify `e.isComposing || e.keyCode === 229` in keydown handlers on input elements.
</troubleshooting>
