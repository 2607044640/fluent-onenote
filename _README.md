# A1 OneNote Navigation

<context>
For underlying architecture specifications, state management, API signatures, and developer recipes, please refer to: [_Architecture.md](file:///C:/ObsidianDev/plugins/A1OneNote/_Architecture.md).
</context>

**A1 OneNote** brings the familiar, ultra-fast **3-pane navigation** of Microsoft OneNote directly into Obsidian. Effortlessly organize, search, and navigate your notes across Notebooks, Sections, and Pages with full keyboard control, middle-click batch tab opening, native right-click context menus, and active note auto-reveal.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian Version](https://img.shields.io/badge/Obsidian-v1.0.0%2B-purple.svg)

---

<layer_1_quick_start>
## 🚀 Layer 1: Quick Start Guide

### 🛠️ Installation & Setup
1. Copy `main.js`, `styles.css`, and `manifest.json` into your vault's `.obsidian/plugins/A1OneNote/` directory.
2. Enable **A1 OneNote** in Obsidian Community Plugins settings.
3. Open **Obsidian Settings -> Hotkeys**, search for `A1 OneNote`, and assign a hotkey (e.g., `Ctrl+Shift+O` or `Alt+O`).

### 🎮 Primary Controls Cheatsheet
| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open Navigation Popup** | Hotkey / Command: `Open navigation popup` | Opens floating 3-pane modal UI |
| **Open Sidebar View** | Command: `Open navigation sidebar` | Opens persistent sidebar tab view |
| **Navigate List** | `ArrowUp` / `ArrowDown` | Move item selection vertically |
| **Cross-Pane Jump** | `ArrowRight` (on Section) | Jump focus to Pages column |
| **Exact Back Alignment** | `ArrowLeft` (on Page) | Jump focus to exact Section row |
| **Open Note & Dismiss** | `Enter` or `Space` | Open note in active editor and close popup |
| **Open in Background Tab** | `Middle-Click` / `Ctrl+Click` / `Ctrl+Enter` | Open in new tab **without closing popup** |
| **Search Notes** | Type any letter/number key | Instant search across all notebook notes |
| **Exit Search Box** | `ArrowUp` / `ArrowDown` / `Tab` | Return focus to navigation list |
| **Safe Delete Note** | `Delete` or `Backspace` (on Page) | Move note to trash with sub-page protection |
| **Context Menu** | `Right-Click` on Notebook, Section, or Page | Native Obsidian actions |
</layer_1_quick_start>

---

<layer_2_detailed_guide>
## 📖 Layer 2: Feature Specifications

### 📁 2-Pane OneNote Architecture with Header Notebook Dropdown
- **Sections Column (Left)**: Displays section folders under the active Notebook as 1-level flat cards. Top header features a sleek **OneNote-style Notebook Selector Dropdown** (`[ 📔 Notebook Name ▾ ]`).
- **Pages Column (Right)**: Displays all markdown notes and nested sub-pages belonging to the selected section.
- **Notebook Popover Dropdown**: Click the notebook name in the top-left header to toggle a smooth popover floating window. Easily switch notebooks, view section counts, add new notebooks, or drag & drop to reorder notebooks within the popup dropdown menu.
- **Dual Display Modes**: Use it as a floating popup modal (`Ctrl+Shift+O` recommended) or embed it as a persistent sidebar tab.

### 🌲 OneNote Sub-Page Hierarchy (Folder-Note Seamless Fusion)
- **Native OneNote Nesting Support**: Perfectly handles OneNote notes imported into Obsidian where a note is also a folder containing sub-notes.
- **Dual Action Node**:
  - **Click Title**: Immediately open the main parent note in Obsidian.
  - **Click Chevron `>` / `∨`**: Expand or collapse nested Sub-pages underneath in the Pages pane with visual indentation.
- **Sub-Page Safe Unnesting Deletion**: Deleting a parent Folder-Note automatically promotes all child sub-pages up to the parent Section directory so child notes are never lost or hidden.

### ⌨️ Keyboard Navigation Physics
- **Container Focus by Default**: Opening the popup immediately focuses the list container for instant arrow-key navigation.
- **`ArrowUp` / `ArrowDown`**: Navigate smoothly through notebooks, sections, or pages.
- **`ArrowRight`**: Jump focus across to the **Pages** column.
- **`ArrowLeft`**: Return focus to the corresponding **Section** line on the left.

### 🔍 Type Any Key to Search
- **Instant Search-as-you-Type**: Simply start typing any character to filter all notes across all notebooks.
- **Section Badges**: Filtered results display section tags showing where every match resides.
- **Arrow Key Exit**: Pressing any arrow key inside the search box automatically exits search focus back to the list tree.

### 🖱️ Drag & Drop & Sibling Protection
- **Notebook Reordering**: Drag and drop Notebook cards within Pane 1 to customize notebook order.
- **Section Reordering**: Drag and drop Section cards within Pane 2 to customize section order under active Notebook.
- **Page Reordering (Sibling-Only Protection)**: Drag and drop Page notes within Pane 3 to reorder notes. Only **sibling items** can be reordered; dragging a page across different parent levels automatically triggers a Notice toast: `"必须同级才能拖拽 / Only sibling pages can be reordered"`.
- **Page -> Section / Notebook Move**: Drag any Page note onto a Section or Notebook folder card to move the note/folder file into that directory.
</layer_2_detailed_guide>

---

<layer_3_advanced>
## ⚙️ Layer 3: Advanced Options & Configuration

Go to **Obsidian Settings -> Community Plugins -> A1 OneNote**:

1. **Root Folder Path**: Specify a vault folder to act as your notebook root (e.g. `OneNote`). Leave empty to scan the entire vault.
2. **Display Mode**: Choose between `Floating popup only` or `Both (sidebar + floating popup)`.
3. **DOM Virtualization for Large Vaults**: Toggle viewport slicing optimization for sections containing large numbers of notes.
4. **Popup Modal Size Options**: Adjust **Modal Width (%)** and **Modal Height (%)** with dynamic sliders.
5. **Accent Color**: Tailor theme accent colors to match your Obsidian theme.
</layer_3_advanced>
