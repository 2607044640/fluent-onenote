<script lang="ts">
    import { onMount, onDestroy, setContext } from "svelte";
    import { DataService } from "./DataService";
    import { type NotebookInfo, type SectionInfo, type PageInfo, EventName } from "./types";
    import { type App, type EventRef, TFolder, Notice } from "obsidian";
    import NotebookTreeItem from "./NotebookTreeItem.svelte";
    import SectionTreeItem from "./SectionTreeItem.svelte";
    import PageTreeItem from "./PageTreeItem.svelte";
    import { EventBus } from "./EventBus";
    import { ContextMenuHelper } from "./ContextMenuHelper";
    import { PathUtils } from "./utils/PathUtils";
    import { OneNoteViewModel } from "./store/OneNoteViewModel";

    // =============================================
    // Props
    // =============================================
    export let app: App;
    export let plugin: any = null;
    export let dataService: DataService;
    export let rootFolder: string = "OneNote";
    export let enableVirtualization: boolean = false;
    export let initialExpandedPaths: string[] = [];
    export let initialSelectedSectionPath: string = "";
    export let onExpandedChanged: (paths: string[]) => void = () => {};
    export let onSectionSelectedChanged: (path: string) => void = () => {};
    export let onPageOpened: (filepath: string) => void = () => {};

    // ViewModel setup
    const vm = new OneNoteViewModel(app, plugin, dataService, rootFolder, initialExpandedPaths, initialSelectedSectionPath);
    setContext("vm", vm);

    const notebooks = vm.notebooks;
    const selectedNotebook = vm.selectedNotebook;
    const sections = vm.sections;
    const selectedSection = vm.selectedSection;
    const activePagePath = vm.activePagePath;
    const rootFolderExists = vm.rootFolderExists;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    // Unique view instance ID to prevent self-echo loops
    const instanceId = "sidebar-" + Math.random().toString(36).substring(2, 9);

    // Virtualization calculations
    let scrollTop = 0;
    const ITEM_HEIGHT = 32;
    const BUFFER_ITEMS = 10;

    $: visibleRange = (() => {
        const pages = $selectedSection ? $selectedSection.pages : [];
        if (!enableVirtualization || pages.length < 100) {
            return {
                pages,
                topPadding: 0,
                bottomPadding: 0,
                startIndex: 0
            };
        }
        
        const visibleCount = Math.ceil(400 / ITEM_HEIGHT);
        const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
        const end = Math.min(pages.length, start + visibleCount + BUFFER_ITEMS * 2);

        return {
            pages: pages.slice(start, end),
            topPadding: start * ITEM_HEIGHT,
            bottomPadding: (pages.length - end) * ITEM_HEIGHT,
            startIndex: start
        };
    })();

    // Popover Dropdown State
    let showNotebookDropdown: boolean = false;
    let popoverContainerEl: HTMLElement;

    // Features & Shortcuts Guide State
    let showGuideModal: boolean = false;
    let showGuideHoverPopover: boolean = false;
    let guidePopoverX: number = 0;
    let guidePopoverY: number = 0;
    let guideHoverTimeout: any = null;

    function handleGuideMouseEnter(e: MouseEvent) {
        if (guideHoverTimeout) clearTimeout(guideHoverTimeout);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        guidePopoverX = rect.left + rect.width / 2;
        guidePopoverY = rect.bottom + 6;
        showGuideHoverPopover = true;
    }

    function handleGuideMouseLeave() {
        guideHoverTimeout = setTimeout(() => {
            showGuideHoverPopover = false;
        }, 150);
    }

    function toggleNotebookDropdown(e: MouseEvent) {
        e.stopPropagation();
        showNotebookDropdown = !showNotebookDropdown;
    }

    function handleWindowClick(e: MouseEvent) {
        if (showNotebookDropdown && popoverContainerEl && !popoverContainerEl.contains(e.target as Node)) {
            showNotebookDropdown = false;
        }
    }

    function handleGlobalCapturePointerDown(e: PointerEvent) {
        if (!showNotebookDropdown) return;
        const target = e.target as Node | null;
        if (target && popoverContainerEl && !popoverContainerEl.contains(target)) {
            showNotebookDropdown = false;
        }
    }

    let vaultEventRefs: EventRef[] = [];

    onMount(() => {
        vm.loadNotebooks();
        window.addEventListener("pointerdown", handleGlobalCapturePointerDown, true);

        const activeApp = app || (window as any).app;
        if (activeApp) {
            const refModify = activeApp.vault.on("modify", () => vm.loadNotebooks());
            const refDelete = activeApp.vault.on("delete", () => vm.loadNotebooks());
            const refCreate = activeApp.vault.on("create", () => vm.loadNotebooks());
            const refRename = activeApp.vault.on("rename", () => vm.loadNotebooks());
            vaultEventRefs.push(refModify, refDelete, refCreate, refRename);

            const activeLeaf = activeApp.workspace.getActiveFile();
            if (activeLeaf) {
                vm.activePagePath.set(activeLeaf.path);
            }

            activeApp.workspace.on("file-open", handleActiveLeafChange);
        }

        EventBus.on(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged);
        EventBus.on(EventName.SECTION_SELECTED, handleSectionSelected);
        EventBus.on(EventName.ORDER_CHANGED, handleOrderChanged);
    });

    onDestroy(() => {
        window.removeEventListener("pointerdown", handleGlobalCapturePointerDown, true);
        vaultEventRefs.forEach(ref => app.vault.offref(ref));
        app.workspace.off("file-open", handleActiveLeafChange);
        EventBus.off(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged);
        EventBus.off(EventName.SECTION_SELECTED, handleSectionSelected);
        EventBus.off(EventName.ORDER_CHANGED, handleOrderChanged);
        vm.destroy();
    });

    $: if (rootFolder !== undefined) {
        vm.rootFolder = rootFolder;
        vm.loadNotebooks();
    }
    
    // Subscribe to view model selection to trigger outward callbacks
    $: {
        if ($selectedSection) {
            onSectionSelectedChanged($selectedSection.folderPath);
        }
    }

    function openPage(page: PageInfo, inNewTab: boolean = false) {
        vm.activePagePath.set(page.filepath);
        onPageOpened(page.filepath);
        const activeApp = app || (window as any).app;
        if (activeApp) {
            const file = activeApp.vault.getAbstractFileByPath(page.filepath);
            if (file && file instanceof TFolder) return;
            if (file) {
                if (inNewTab) {
                    activeApp.workspace.getLeaf('tab').openFile(file as any);
                } else {
                    activeApp.workspace.getLeaf(false).openFile(file as any);
                }
            }
        }
    }

    function handleActiveLeafChange(file: any) {
        if (!file) return;
        vm.activePagePath.set(file.path);
    }

    function handleExpandedChanged(payload: any) {}
    function handleSectionSelected(payload: any) {}
    function handleOrderChanged() {
        vm.loadNotebooks();
    }

    function handlePageAuxClick(e: MouseEvent, page: PageInfo) {
        if (e.button === 1) {
            openPage(page, true);
        }
    }

    function handlePageContextMenu(e: MouseEvent, page: PageInfo) {
        e.preventDefault();
        e.stopPropagation();
        const activeApp = app || (window as any).app;
        if (activeApp) {
            ContextMenuHelper.showPageContextMenu(e, activeApp, page, $selectedSection?.folderPath || "", () => vm.loadNotebooks());
        }
    }

    async function handleQuickNewNote() {
        let targetFolderPath = $selectedSection?.folderPath;
        if (!targetFolderPath) {
            targetFolderPath = rootFolder.trim() !== "" ? rootFolder : "";
        }
        const activeApp = app || (window as any).app;
        if (activeApp) {
            const newFile = await ContextMenuHelper.createNewPage(activeApp, targetFolderPath);
            if (newFile) {
                vm.loadNotebooks();
                vm.activePagePath.set(newFile.path);
                onPageOpened(newFile.path);
            }
        }
    }

    async function handleQuickNewSection() {
        let targetFolderPath = $selectedNotebook?.folderPath;
        if (!targetFolderPath) {
            targetFolderPath = rootFolder.trim() !== "" ? rootFolder : "";
        }
        const activeApp = app || (window as any).app;
        if (activeApp) {
            const newFolder = await ContextMenuHelper.createNewSection(activeApp, targetFolderPath);
            if (newFolder) {
                vm.loadNotebooks();
            }
        }
    }

    async function handleQuickNewNotebook() {
        const activeApp = app || (window as any).app;
        if (activeApp) {
            const newFolder = await ContextMenuHelper.createNewSection(activeApp, rootFolder);
            if (newFolder) {
                vm.loadNotebooks();
            }
        }
    }
</script>


<svelte:window on:click={handleWindowClick} />

<div class="on-container">
    {#if !rootFolderExists}
        <div class="on-error-container">
            <div class="on-error-header">
                <span class="on-error-icon">⚠️</span>
                <span class="on-error-title">OneNote Root Not Found</span>
            </div>
            <div class="on-error-body">
                The configured root folder <code>"{rootFolder}"</code> does not exist in your vault.
            </div>
        </div>
    {:else}
        <!-- Pane 1: Sections (分区) with Header Notebook Dropdown -->
        <div class="on-sections-pane">
            <div class="on-pane-header on-pane-header-with-action on-notebook-popover-container" bind:this={popoverContainerEl}>
                <!-- Notebook Dropdown Selector Button -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <button 
                    class="on-notebook-select-btn" 
                    class:active={showNotebookDropdown}
                    on:click={toggleNotebookDropdown}
                    title="Switch notebook"
                >
                    <span class="on-notebook-icon">📔</span>
                    <span class="on-notebook-name">{$selectedNotebook ? $selectedNotebook.name : "Select Notebook"}</span>
                    <span class="on-caret">▾</span>
                </button>

                <button 
                    class="on-btn-quick-add" 
                    title="Create new section"
                    on:click={() => handleQuickNewSection()}
                >
                    + New
                </button>

                <button 
                    type="button" 
                    class="on-btn-guide-sidebar" 
                    on:mouseenter={handleGuideMouseEnter}
                    on:mouseleave={handleGuideMouseLeave}
                    on:click={() => { showGuideHoverPopover = false; showGuideModal = true; }}
                    title="Fluent OneNote Features & Shortcuts Guide"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </button>

                <!-- Notebook Popover Dropdown Menu -->
                {#if showNotebookDropdown}
                    <div class="on-notebook-popover">
                        <div class="on-popover-header">
                            <span>Notebooks ({$notebooks.length})</span>
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <span 
                                class="on-btn-quick-add" 
                                style="cursor: pointer;" 
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => { if (e.key === 'Enter') { handleQuickNewNotebook(); showNotebookDropdown = false; } }}
                                on:click|stopPropagation={() => { handleQuickNewNotebook(); showNotebookDropdown = false; }}
                            >
                                + New
                            </span>
                        </div>
                        <div class="on-popover-list">
                            {#if $notebooks.length === 0}
                                <div class="on-empty-msg">No notebooks found.</div>
                            {/if}
                            {#each $notebooks as nb (nb.folderPath)}
                                <NotebookTreeItem notebook={nb} />
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <div class="on-list">
                {#if $sections.length === 0}
                    <div class="on-empty-msg">No sections in this notebook.</div>
                {/if}
                
                {#each $sections as sec (sec.folderPath)}
                    <SectionTreeItem {sec} />
                {/each}
            </div>
        </div>

        <!-- Pane 2: Pages/Notes in Selected Section (页面) -->
        <div class="on-pages-pane">
            <div class="on-pane-header on-pane-header-with-action">
                <span>Pages</span>
                <button 
                    class="on-btn-quick-add" 
                    title="New Note in section"
                    on:click={() => handleQuickNewNote()}
                >
                    + New Page
                </button>
            </div>
            <div class="on-list" on:scroll={(e) => scrollTop = e.currentTarget.scrollTop}>
                {#if $selectedSection}
                    {#if $selectedSection.pages.length === 0}
                        <div class="on-empty-msg">No pages in this section.</div>
                    {:else}
                        {#if visibleRange.topPadding > 0}
                            <div style="height: {visibleRange.topPadding}px;"></div>
                        {/if}
                        {#each visibleRange.pages as page (page.filepath)}
                            <PageTreeItem 
                                {page}
                                depth={0}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                            />
                        {/each}
                        {#if visibleRange.bottomPadding > 0}
                            <div style="height: {visibleRange.bottomPadding}px;"></div>
                        {/if}
                    {/if}
                {:else}
                    <div class="on-empty-msg">Select a section to view pages.</div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Quick Hover Guide Popover -->
    {#if showGuideHoverPopover}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
            class="on-guide-hover-popover"
            style="top: {guidePopoverY}px; left: {guidePopoverX}px;"
            on:mouseenter={() => { if (guideHoverTimeout) clearTimeout(guideHoverTimeout); }}
            on:mouseleave={handleGuideMouseLeave}
        >
            <div class="on-guide-popover-header">
                <span class="on-guide-popover-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    FLUENT ONENOTE GUIDE
                </span>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span class="on-guide-popover-link" role="button" tabindex="0" on:click={() => { showGuideHoverPopover = false; showGuideModal = true; }}>
                    Click for full guide
                </span>
            </div>
            <div class="on-guide-popover-list">
                <div class="on-guide-item">
                    <span class="on-guide-key">🌐 All / 📓 Current Scope</span>
                    <span class="on-guide-desc">Toggle search between all notebooks and current active notebook</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Cross-Pane Jump (→ / ←)</span>
                    <span class="on-guide-desc">ArrowRight on section to jump to pages; ArrowLeft on page to return to section</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Background Tab Open</span>
                    <span class="on-guide-desc">Middle-Click / Ctrl+Click / Ctrl+Enter opens note in new tab without closing popup</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Folder-Notes & Sub-Pages</span>
                    <span class="on-guide-desc">Click title to open note; click chevron to expand/collapse nested sub-pages</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Quick Note (Ctrl + N)</span>
                    <span class="on-guide-desc">Instantly create a new note inside the active section</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Physics Drag & Drop</span>
                    <span class="on-guide-desc">Reorder notebooks, sections, and sibling pages with 60px rAF auto-scroll</span>
                </div>
                <div class="on-guide-item">
                    <span class="on-guide-key">Right Click</span>
                    <span class="on-guide-desc">Native context menus (Rename, Delete, New Note/Section)</span>
                </div>
            </div>
        </div>
    {/if}

    <!-- Features & Shortcuts Full Guide Modal -->
    {#if showGuideModal}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="on-guide-modal-backdrop" on:click={(e) => e.target === e.currentTarget && (showGuideModal = false)} role="presentation">
            <div class="on-guide-modal-dialog" role="dialog" aria-modal="true" tabindex="-1">
                <div class="on-guide-modal-header">
                    <div class="on-guide-modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Fluent OneNote Features & Shortcuts Guide</span>
                    </div>
                    <span class="on-guide-modal-close" on:click={() => showGuideModal = false} role="button" tabindex="0" title="Close Guide">✕</span>
                </div>
                <div class="on-guide-modal-body">
                    <!-- 1. Keyboard Shortcuts -->
                    <div class="on-guide-section">
                        <div class="on-guide-section-title">⚡ Navigation & Keyboard Shortcuts (快捷键与按键流)</div>
                        <div class="on-guide-grid">
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">↑ / ↓</span> Item Traversal</div>
                                <div class="on-guide-card-body">Navigate selection up and down in the active pane. In the search input, <kbd>↑</kbd> and <kbd>↓</kbd> traverse matches without losing input focus.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">→ / ←</span> Cross-Pane Focus & Sub-Pages</div>
                                <div class="on-guide-card-body">Press <kbd>→</kbd> on a section card to jump focus across into Pages. Press <kbd>←</kbd> on any page to return to the exact section row. On Folder-Notes, <kbd>→</kbd> / <kbd>←</kbd> expands or collapses sub-pages.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Enter / Space</span> Open & Dismiss</div>
                                <div class="on-guide-card-body">Instantly open the selected note in your active Obsidian editor and dismiss the navigation popup.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Ctrl + Click / Middle-Click</span> Background Tab</div>
                                <div class="on-guide-card-body">Middle-click, <kbd>Ctrl+Click</kbd>, or <kbd>Ctrl+Enter</kbd> opens the note in a new background tab <strong>without closing the popup</strong>, ideal for batch opening references.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Ctrl + N</span> Quick Note Creation</div>
                                <div class="on-guide-card-body">Press <kbd>Ctrl+N</kbd> (or click <kbd>+ New Page</kbd>) to instantly create a new note inside the active section.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Delete / Backspace</span> Safe Trash Deletion</div>
                                <div class="on-guide-card-body">Safely move note to trash with automatic child un-nesting protection. Deleting a parent Folder-Note promotes child notes to the section so data is never lost.</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Search & Scope -->
                    <div class="on-guide-section">
                        <div class="on-guide-section-title">🔍 Fast Search & Scope Modes (全局与单笔记本搜索)</div>
                        <div class="on-guide-grid">
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Auto Focus</span> Instant Typing & Full IME</div>
                                <div class="on-guide-card-body">Popup automatically focuses the search bar on open. Guaranteed zero dropped keystrokes for Chinese, Japanese, and Korean IMEs (微信输入法, 微软拼音, 搜狗).</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">🌐 All / 📓 Current</span> One-Click Scope Toggle</div>
                                <div class="on-guide-card-body">Click the toggle button in the search header to switch between <strong>Single Notebook Scoped Search</strong> (clean section badges) and <strong>Global Vault Search</strong> (composite <code>Notebook / Section</code> path badges).</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Escape</span> Progressive Clear / Close</div>
                                <div class="on-guide-card-body">First press of <kbd>Escape</kbd> clears the search query; second press closes the navigation modal.</div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Hierarchy & Physics -->
                    <div class="on-guide-section">
                        <div class="on-guide-section-title">📁 Folder-Notes & Physics Engine (文件夹笔记与物理引擎)</div>
                        <div class="on-guide-grid">
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Fusion</span> Folder-Note Architecture</div>
                                <div class="on-guide-card-body">When a folder and a markdown note share the same name in a section, they fuse into a parent node. Click the title to open the note; click the chevron to expand/collapse sub-pages.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Physics DND</span> 60px rAF Auto-Scroll</div>
                                <div class="on-guide-card-body">Drag & drop notebooks, sections, and sibling pages with 0ms visual latency. Approaching top or bottom boundaries smoothly auto-scrolls the list. Drag pages onto section cards to move files.</div>
                            </div>
                            <div class="on-guide-card">
                                <div class="on-guide-card-header"><span class="on-guide-badge-pill">Right Click</span> Context Actions Menu</div>
                                <div class="on-guide-card-body">Right-click any Notebook, Section, or Page to open native Obsidian context actions (Rename, Delete, New Note, New Section, Open in New Tab).</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
