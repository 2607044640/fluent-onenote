# Fluent OneNote

A beautiful, 2-pane navigation plugin for Obsidian notes, inspired by Microsoft OneNote and Fluent Design principles.

> [!NOTE]
> If you are looking for a local alternative to **Microsoft OneNote**, **Evernote**, **UpNote**, **Bear**, or **Joplin** directly inside your Obsidian vault, Fluent OneNote brings a familiar, ultra-fast 2-pane navigation system across Notebooks, Sections, and Pages.

<context>
For underlying architecture specifications, state management, API signatures, and AI-assisted development ("vibe coding"), please refer to: [fluent-onenote_Architecture.md](file:///C:/ObsidianPublish/fluent-onenote/fluent-onenote_Architecture.md).
</context>

## Key Features

### 1. 2-Pane Navigation Architecture
![Cross-Pane Navigation](media/cross_pane_navigation.gif)
- **Sections Column (Left)**: Displays section folders under the active Notebook as flat cards. The header features a sleek OneNote-style Notebook Selector dropdown.
- **Pages Column (Right)**: Displays all markdown notes and nested sub-pages belonging to the selected section.
- **Cross-Pane Jump**: Seamlessly switch between sections and pages just like native OneNote.

### 2. Instant Note Search
![Instant Search](media/instant_search.gif)
- Type any letter or number key while the navigation panel is open to instantly search across all notes in the active notebook.

### 3. Global Hotkey Navigation
![Quick Hotkey](media/quick_hotkey.gif)
- Access your notebooks from anywhere. Bind a custom hotkey to instantly open the navigation popup, locate your notes, or create new ones without losing your current context.

### 4. Drag & Drop Reordering
![Drag and Drop](media/drag_and_drop.gif)
- Effortlessly drag and drop to reorder Sections and Pages.
- Move pages between sections seamlessly. Your custom order is automatically saved in real-time.

### 5. Customizable UI Size & Accent Colors
![Customization](media/customization.gif)
- Freely customize the popup modal width, height, and primary accent colors to match your personal aesthetic.

### 6. Sidebar Mode & Floating Popup
![Sidebar Mode](media/sidebar_mode.gif)
- **Display Modes**: Supports both a persistent sidebar tab and a floating popup modal.
- *Note: Using the persistent sidebar mode is not highly recommended as the 2-pane layout takes up a significant amount of horizontal screen space. We highly recommend setting a custom global hotkey to use the floating popup modal instead.*

---

## Important Notes & Troubleshooting

> [!IMPORTANT]
> Please read these critical setup notes to ensure Fluent OneNote functions correctly with your vault.

1. **Set a Global Hotkey (Highly Recommended)**: Go to **Obsidian Settings -> Hotkeys**, search for `Fluent OneNote: Open navigation popup`, and assign a custom shortcut of your choice. This is the intended and most efficient way to use the plugin.
2. **Empty Navigation Panel? Check Root Folder**: If your navigation panel shows up completely empty, please check your plugin settings. The "Root Folder Path" must match the **exact case-sensitive name** of an existing folder in your vault (e.g., `OneNote`). If you want to scan and see all notes across the entire vault, leave this field completely empty.
3. **Folder-Note Fusion**: The plugin supports nested sub-pages. If a folder and a markdown note share the exact same name in the same directory, it automatically acts as a parent "Folder-Note" allowing infinite nested sub-pages.
4. **Drag & Drop Limitations**: Reordering pages is restricted to sibling items only. You cannot drag a page to become a child of another standard page unless the target is a Folder-Note.
5. **DOM Virtualization**: If you experience scroll lag when opening a massive folder (e.g., 5000+ notes), enable the experimental `DOM Virtualization` option in settings.

---

## Primary Controls Cheatsheet

| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open Navigation Popup** | Custom Hotkey | Opens floating 2-pane modal UI |
| **Navigate List** | `ArrowUp` / `ArrowDown` | Move item selection vertically |
| **Cross-Pane Jump** | `ArrowRight` (on Section) | Jump focus to Pages column |
| **Exact Back Alignment** | `ArrowLeft` (on Page) | Jump focus to exact Section row |
| **Open Note & Dismiss** | `Enter` or `Space` | Open note in active editor and close popup |
| **Open in Background Tab** | `Middle-Click` / `Ctrl+Click` | Open in new tab without closing popup |

---

## Contributing & Vibe Coding

We welcome contributions! Whether you are writing TypeScript code directly or using AI agents ("vibe coding"), follow these steps to get started:

1. **Clone & Install**:
   ```bash
   git clone https://github.com/2607044640/fluent-onenote.git
   cd fluent-onenote
   npm install
   ```
2. **Build & Watch**:
   - Development watch mode: `npm run dev`
   - Production build: `npm run build`
3. **Architecture Reference**:
   Read [fluent-onenote_Architecture.md](file:///C:/ObsidianPublish/fluent-onenote/fluent-onenote_Architecture.md) to understand state flows, scanner rules, and system invariants before submitting pull requests.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

###### Keywords
`onenote` `onenote alternative` `evernote` `upnote` `bear` `joplin` `notebook navigation` `2-pane view` `sections and pages` `subpages` `fluent design`
