# Fluent OneNote

A beautiful, 2-pane navigation plugin for Obsidian notes, inspired by Microsoft OneNote and Fluent Design principles.

> [!NOTE]
> If you are looking for a local alternative to **Microsoft OneNote**, **Evernote**, **UpNote**, **Bear**, or **Joplin** directly inside your Obsidian vault, Fluent OneNote brings a familiar, ultra-fast 2-pane navigation system across Notebooks, Sections, and Pages.

---

## Quick Setup & Recommended Workflow

### 1. Assign a Global Hotkey (Highly Recommended)
Fluent OneNote is designed around an instant, distraction-free popup workflow.

1. Open **Obsidian Settings** -> **Hotkeys**.
2. Search for **`Fluent OneNote: Open navigation popup`**.
3. Assign your preferred shortcut (e.g. `Ctrl + Shift + A`, `Alt + O`, or `Ctrl + Shift + O`).

Whenever you need to switch notes or capture a quick thought, press your hotkey, browse or search across sections, and press `Enter` to jump right into the note without leaving your typing flow.

---

## Key Features

### 1. 2-Pane Navigation Architecture
![Cross-Pane Navigation](media/cross_pane_navigation.gif)
- **Sections Column (Left)**: Displays section folders under the active Notebook as clean cards with item counters. The header features a sleek OneNote-style Notebook Selector dropdown.
- **Pages Column (Right)**: Displays all notes and nested sub-pages belonging to the selected section.
- **Cross-Pane Focus**: Seamlessly jump focus between sections and pages with arrow keys or mouse clicks.

### 2. Floating Popup & Fast Keyboard Navigation
![Quick Hotkey](media/quick_hotkey.gif)
- Access your entire notebook hierarchy from anywhere in Obsidian.
- Instant keyboard navigation with arrow keys, quick selection, and background tab opening.

### 3. Instant Search-as-you-Type
![Instant Search](media/instant_search.gif)
- Type any character while the navigation panel is open to instantly filter notes across the entire notebook.
- Results display section badges indicating exactly where each match is located.

### 4. Drag & Drop Reordering
![Drag and Drop](media/drag_and_drop.gif)
- Easily drag and drop to reorder Notebooks, Sections, and Pages.
- Move pages between sections seamlessly. Your custom order is persisted in real time.

### 5. Folder-Note Sub-Page Hierarchy
- Supports multi-level nested sub-pages.
- When a folder and a markdown note share the same name within a section, they automatically fuse into a parent "Folder-Note" with collapsible sub-pages.
- Safe deletion protects nested child notes from accidental loss.

### 6. Customizable Dimensions & Theme Accent Colors
![Customization](media/customization.gif)
- Customize the popup modal width (40%–98%) and height (40%–95%) to fit your screen size.
- Pick a custom accent color to harmonize with your Obsidian theme.

### 7. Dual Display Modes
![Sidebar Mode](media/sidebar_mode.gif)
- Choose between **Floating popup only** or **Both (sidebar + floating popup)** in plugin settings depending on your layout preference.

---

## Keyboard Controls Cheatsheet

| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open Navigation Popup** | Custom Hotkey | Open floating 2-pane navigation modal |
| **Navigate Items** | `ArrowUp` / `ArrowDown` | Move selection vertically |
| **Jump to Pages Pane** | `ArrowRight` (on Section) | Shift active focus into the Pages column |
| **Return to Section Pane** | `ArrowLeft` (on Page) | Shift active focus back to the Section row |
| **Open Note & Dismiss** | `Enter` / `Space` | Open note in active editor and close popup |
| **Open in Background Tab** | `Middle-Click` / `Ctrl+Click` / `Ctrl+Enter` | Open in new tab without closing popup |
| **Create New Note** | `Ctrl + N` (or `+ New Page` button) | Create a new note inside active section |
| **Filter / Search Notes** | Type any alphanumeric key | Focus search bar and filter matching notes |
| **Clear Search** | `Escape` or clear button `✕` | Reset filter query |
| **Context Menu** | `Right-Click` on any item | Access native actions (Rename, Delete, Copy link) |

---

## Configuration Options

Go to **Obsidian Settings** -> **Community Plugins** -> **Fluent OneNote**:

- **Root Folder Path**: The root vault folder containing your notebooks (default: `OneNote`). Leave blank to scan your entire vault.
- **Display Mode**: Toggle between `Floating popup only` and `Both (sidebar + floating popup)`.
- **DOM Virtualization**: Optional viewport optimization for sections containing large numbers of notes.
- **Popup Modal Width / Height**: Adjust the dimensions of the popup modal.
- **Accent Color**: Pick a custom accent color for focus highlights and active badges.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

###### Keywords
`onenote` `onenote alternative` `evernote` `upnote` `bear` `joplin` `notebook navigation` `2-pane view` `sections and pages` `subpages` `fluent design` `quick switcher` `hotkey navigation`
