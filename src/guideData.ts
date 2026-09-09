export interface GuideCardItem {
    badge: string;
    title: string;
    description: string;
}

export interface GuideSectionData {
    title: string;
    cards: GuideCardItem[];
}

export interface GuideQuickItem {
    key: string;
    desc: string;
}

export const GUIDE_QUICK_ITEMS: GuideQuickItem[] = [
    {
        key: "📁 Root Folder Scope",
        desc: "Scans dedicated folder (default: 'OneNote') or entire vault if blank (Settings)"
    },
    {
        key: "🌐 All / 📓 Current Scope",
        desc: "Toggle search between all notebooks and current active notebook"
    },
    {
        key: "Cross-Pane Jump (→ / ←)",
        desc: "ArrowRight on section to jump to pages; ArrowLeft on page to return to section"
    },
    {
        key: "Background Tab Open",
        desc: "Middle-Click / Ctrl+Click / Ctrl+Enter opens note in new tab without closing popup"
    },
    {
        key: "Folder-Notes & Sub-Pages",
        desc: "Click title to open note; click chevron to expand/collapse nested sub-pages"
    },
    {
        key: "Quick Note (Ctrl + N)",
        desc: "Instantly create a new note inside the active section"
    },
    {
        key: "Physics Drag & Drop",
        desc: "Reorder notebooks, sections, and sibling pages with 60px rAF auto-scroll"
    },
    {
        key: "Right Click",
        desc: "Native context menus (Rename, Delete, New Note/Section)"
    }
];

export const GUIDE_SECTIONS: GuideSectionData[] = [
    {
        title: "⚡ Navigation & Keyboard Shortcuts (快捷键与按键流)",
        cards: [
            {
                badge: "↑ / ↓",
                title: "Item Traversal",
                description: "Navigate selection up and down in the active pane. In the search input, <kbd>↑</kbd> and <kbd>↓</kbd> traverse matches without losing input focus."
            },
            {
                badge: "→ / ←",
                title: "Cross-Pane Focus & Sub-Pages",
                description: "Press <kbd>→</kbd> on a section card to jump focus across into Pages. Press <kbd>←</kbd> on any page to return to the exact section row. On Folder-Notes, <kbd>→</kbd> / <kbd>←</kbd> expands or collapses sub-pages."
            },
            {
                badge: "Enter / Space",
                title: "Open & Dismiss",
                description: "Instantly open the selected note in your active Obsidian editor and dismiss the navigation popup."
            },
            {
                badge: "Ctrl + Click / Middle-Click",
                title: "Background Tab",
                description: "Middle-click, <kbd>Ctrl+Click</kbd>, or <kbd>Ctrl+Enter</kbd> opens the note in a new background tab <strong>without closing the popup</strong>, ideal for batch opening references."
            },
            {
                badge: "Ctrl + N",
                title: "Quick Note Creation",
                description: "Press <kbd>Ctrl+N</kbd> (or click <kbd>+ New Page</kbd>) to instantly create a new note inside the active section."
            },
            {
                badge: "Delete / Backspace",
                title: "Safe Trash Deletion",
                description: "Safely move note to trash with automatic child un-nesting protection. Deleting a parent Folder-Note promotes child notes to the section so data is never lost."
            }
        ]
    },
    {
        title: "🔍 Fast Search & Scope Modes (全局与单笔记本搜索)",
        cards: [
            {
                badge: "Auto Focus",
                title: "Instant Typing & Full IME",
                description: "Popup automatically focuses the search bar on open. Guaranteed zero dropped keystrokes for Chinese, Japanese, and Korean IMEs (微信输入法, 微软拼音, 搜狗)."
            },
            {
                badge: "🌐 All / 📓 Current",
                title: "One-Click Scope Toggle",
                description: "Click the toggle button in the search header to switch between <strong>Single Notebook Scoped Search</strong> (clean section badges) and <strong>Global Vault Search</strong> (composite <code>Notebook / Section</code> path badges)."
            },
            {
                badge: "Escape",
                title: "Progressive Clear / Close",
                description: "First press of <kbd>Escape</kbd> clears the search query; second press closes the navigation modal."
            }
        ]
    },
    {
        title: "📁 Folder-Notes & Physics Engine (文件夹笔记与物理引擎)",
        cards: [
            {
                badge: "Fusion",
                title: "Folder-Note Architecture",
                description: "When a folder and a markdown note share the same name in a section, they fuse into a parent node. Click the title to open the note; click the chevron to expand/collapse sub-pages."
            },
            {
                badge: "Physics DND",
                title: "60px rAF Auto-Scroll",
                description: "Drag & drop notebooks, sections, and sibling pages with 0ms visual latency. Approaching top or bottom boundaries smoothly auto-scrolls the list. Drag pages onto section cards to move files."
            },
            {
                badge: "Right Click",
                title: "Context Actions Menu",
                description: "Right-click any Notebook, Section, or Page to open native Obsidian context actions (Rename, Delete, New Note, New Section, Open in New Tab)."
            }
        ]
    }
];
