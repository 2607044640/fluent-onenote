# Fluent OneNote Navigation

<context>
For underlying architecture specifications, state management, API signatures, and developer recipes, please refer to: [_Architecture.md](file:///C:/ObsidianPublish/fluent-onenote/_Architecture.md).
</context>

**Fluent OneNote** brings the familiar, ultra-fast **2-pane navigation** of Microsoft OneNote directly into Obsidian. Organize, search, and navigate notes across Notebooks, Sections, and Pages with full keyboard control, middle-click background opening, native context menus, physics drag-and-drop, and full Chinese/Japanese/Korean IME search support.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian Version](https://img.shields.io/badge/Obsidian-v1.0.0%2B-purple.svg)

---

<layer_1_quick_start>
## Layer 1: Quick Start Guide

### Installation & Setup
1. Copy `main.js`, `styles.css`, and `manifest.json` into vault directory `.obsidian/plugins/fluent-onenote/`.
2. Enable **Fluent OneNote** in Obsidian Community Plugins settings.
3. Open **Obsidian Settings -> Hotkeys**, search for `Fluent OneNote`, and assign `Fluent OneNote: Open navigation popup` to `Ctrl+Shift+O` or `Alt+O`.

### Primary Controls Cheatsheet
| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open Navigation Popup** | Hotkey / Command: `Open navigation popup` | Opens floating 2-pane modal UI (`Ctrl+Shift+O`) |
| **Open Sidebar View** | Command: `Open navigation sidebar` | Opens persistent sidebar tab view |
| **Open Recent Pages** | Command: `Open recent pages list` | Opens recent notes fuzzy switcher (newest first) |
| **Navigate List** | `ArrowUp` / `ArrowDown` | Move item selection vertically in active pane |
| **Cross-Pane Jump** | `ArrowRight` (on Section) | Jump focus across to Pages column |
| **Exact Back Alignment** | `ArrowLeft` (on Page) | Jump focus back to exact Section row |
| **Toggle Sub-pages** | `ArrowRight` / `ArrowLeft` | Expand or collapse nested sub-pages |
| **Open Note & Dismiss** | `Enter` or `Space` | Open note in active editor and close popup |
| **Open in Background Tab** | `Middle-Click` / `Ctrl+Click` / `Ctrl+Enter` | Open in new tab **without closing popup** |
| **Open Feature Guide** | Click `(?)` icon in header | Opens full interactive features & shortcuts guide modal |
| **Search Notes** | Type any key | Instant search with full IME composition support |
| **Clear Search / Close** | `Escape` | First press resets query; second press closes modal |
| **Create New Note** | `Ctrl + N` (or `+ New Page` button) | Create a new note inside active section |
| **Safe Delete Note** | `Delete` or `Backspace` (on Page) | Move note to trash with child unnesting protection |
| **Context Menu** | `Right-Click` on Notebook, Section, or Page | Native Obsidian actions (Rename, Delete, New) |
</layer_1_quick_start>

---

<layer_2_detailed_guide>
## Layer 2: Feature Specifications

### 2-Pane OneNote Architecture with Header Notebook Dropdown
- **Sections Column (Left)**: Displays section folders under active Notebook as 1-level flat cards with note counts. Top header features a sleek **Notebook Selector Dropdown** (`[ 📔 Notebook Name ▾ ]`).
- **Pages Column (Right)**: Displays all markdown notes and nested sub-pages belonging to selected section.
- **Notebook Popover Dropdown**: Click notebook name in top header to toggle popover menu. Switch notebooks, view section counts, add notebooks, or drag & drop to reorder notebooks.
- **Dual Display Modes**: Use as floating popup modal (`Ctrl+Shift+O` recommended) or persistent sidebar tab.

### OneNote Sub-Page Hierarchy (Folder-Note Seamless Fusion)
- **Folder-Note Fusion**: When a folder and note share the same name in a section, they fuse into a parent "Folder-Note".
- **Dual Action Node**:
  - **Click Title**: Immediately open parent note in editor.
  - **Click Chevron `>` / `∨`**: Expand or collapse nested sub-pages with visual tree indentation.
- **Sub-Page Safe Unnesting Deletion**: Deleting a parent Folder-Note automatically promotes child sub-pages up to parent Section folder so child notes are never deleted or hidden.

### Instant Search with Full IME Support & Global Scope Toggle
- **Auto-Focused Search Input**: Opening the modal auto-focuses the search bar ready for immediate typing.
- **Full IME Handshake**: Guaranteed zero dropped characters for Chinese/Japanese/Korean input methods (WeChat Keyboard, Microsoft Pinyin, Sogou) on the first keystroke.
- **Global vs Single-Notebook Search**:
  - **Single Notebook Mode (`📓 Current`)**: Default search strictly scoped to the active notebook with dynamic placeholder (`Search in "<Notebook>"...`), displaying concise section badges (`[Section]`).
  - **Global Mode (`🌐 All`)**: One-click toggle in the search bar header to search across all notebooks and recursive sub-page hierarchies simultaneously, displaying contextual path badges (`[Notebook / Section]`).
- **Section Badges**: Filtered results display section or notebook/section tags indicating exact note location.
- **In-Box Arrow Traversal**: `ArrowUp` / `ArrowDown` navigate matching list items while typing without losing input focus.

### Physics Drag & Drop & 60px rAF Auto-Scroll
- **Reactivity Throttling**: DragOver store dispatches occur only on element/position change, eliminating 95%+ redundant renders.
- **60px rAF Auto-Scroll**: Damped `requestAnimationFrame` engine smoothly auto-scrolls lists when dragging within 60px of list boundaries (`AUTO_SCROLL_EDGE_ZONE = 60`, `AUTO_SCROLL_MAX_SPEED = 12`, `AUTO_SCROLL_MIN_SPEED = 2`).
- **Sibling-Only Page Drag**: Page reordering is enforced among sibling items only; cross-level dragging displays a Notice toast: `"必须同级才能拖拽 / Only sibling pages can be reordered"`.
- **Page -> Section / Notebook Move**: Dragging a Page onto a Section or Notebook folder card moves the file to that folder.
- **Anti-Flicker Shield**: Pointer events are disabled on child icons/labels during active drag (`body.is-dragging-active .on-item * { pointer-events: none !important; }`).
</layer_2_detailed_guide>

---

<layer_3_advanced>
## Layer 3: Advanced Options & Configuration

Go to **Obsidian Settings -> Community Plugins -> Fluent OneNote**:

1. **Root Folder Path**: Vault folder to act as notebook root (default: `OneNote`). Leave empty to scan entire vault.
2. **Display Mode**: Choose between `Floating popup only` or `Both (sidebar + floating popup)`.
3. **Global Search by Default**: Toggle whether the search popup defaults to searching across all notebooks or only the current notebook.
4. **DOM Virtualization**: Optional viewport optimization for sections containing thousands of notes.
5. **Popup Modal Size**: Adjust **Modal Width (%)** (40%–98%) and **Modal Height (%)** (40%–95%) with dynamic sliders.
6. **Accent Color**: Tailor theme accent color for focus outlines and active badges.
7. **Custom Order Management**:
   - **Export Custom Order**: Download current custom arrangement as a structured `.json` backup.
   - **Import Custom Order**: Restore ordering from `.json` file across vaults or devices.
   - **Clear Custom Order**: Reset all custom ordering to default alphabetical sort (with confirmation dialog).
8. **Reset Hotkey Tips Counter**: Reset startup recommendation notice cooldown.
</layer_3_advanced>
