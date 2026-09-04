<script lang="ts">
    import { onMount, onDestroy, setContext } from "svelte";
    import { DataService } from "./DataService";
    import { type NotebookInfo, type SectionInfo, type PageInfo, EventName, type ExpandedSectionsChangedPayload, type SectionSelectedPayload } from "./types";
    import { type App, Notice } from "obsidian";
    import NotebookTreeItem from "./NotebookTreeItem.svelte";
    import SectionTreeItem from "./SectionTreeItem.svelte";
    import PageTreeItem from "./PageTreeItem.svelte";
    import { EventBus } from "./EventBus";
    import { ContextMenuHelper } from "./ContextMenuHelper";
    import { PAGE_ITEM_HEIGHT, VIRTUAL_BUFFER_ITEMS } from "./constants";
    import { OneNoteViewModel } from "./store/OneNoteViewModel";

    // =============================================
    // Props
    // =============================================
    export let app: App;
    export let plugin: any = null;
    export let dataService: DataService;
    export let rootFolder: string = "OneNote";
    export let enableVirtualization: boolean = false;
    export let showTip: boolean = false;
    export let remainingTips: number = 0;
    export let onPageOpened: (filepath: string) => void = () => {};
    export let initialExpandedPaths: string[] = [];
    export let initialSelectedSectionPath: string = "";
    export let onExpandedChanged: (paths: string[]) => void = () => {};
    export let onSectionSelectedChanged: (path: string) => void = () => {};

    // Unique view instance ID to prevent self-echo loops
    const instanceId = "modal-" + Math.random().toString(36).substring(2, 9);

    const vm = new OneNoteViewModel(app, plugin, dataService, rootFolder, initialExpandedPaths, initialSelectedSectionPath);
    setContext("vm", vm);

    // Subscribe to stores
    const notebooks = vm.notebooks;
    const selectedNotebook = vm.selectedNotebook;
    const sections = vm.sections;
    const selectedSection = vm.selectedSection;
    const activePagePath = vm.activePagePath;
    const rootFolderExists = vm.rootFolderExists;
    const filterQueryStore = vm.filterQuery;
    const searchAllNotebooks = vm.searchAllNotebooks;
    const visibleSections = vm.visibleSections;
    const filteredPages = vm.filteredPages;

    function toggleGlobalSearch(e?: MouseEvent) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const nextVal = !$searchAllNotebooks;
        vm.searchAllNotebooks.set(nextVal);
        if (plugin && plugin.settings) {
            plugin.settings.searchAllNotebooks = nextVal;
            void plugin.saveSettings();
        }
        searchInputEl?.focus();
    }

    // Virtualization calculations
    let scrollTop = 0;

    $: visibleRange = (() => {
        if (!enableVirtualization || $filteredPages.length < 100) {
            return {
                pages: $filteredPages,
                topPadding: 0,
                bottomPadding: 0,
                startIndex: 0
            };
        }
        
        const visibleCount = Math.ceil(400 / PAGE_ITEM_HEIGHT);
        const start = Math.max(0, Math.floor(scrollTop / PAGE_ITEM_HEIGHT) - VIRTUAL_BUFFER_ITEMS);
        const end = Math.min($filteredPages.length, start + visibleCount + VIRTUAL_BUFFER_ITEMS * 2);

        return {
            pages: $filteredPages.slice(start, end),
            topPadding: start * PAGE_ITEM_HEIGHT,
            bottomPadding: ($filteredPages.length - end) * PAGE_ITEM_HEIGHT,
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

    function handleContainerPointerDown(e: PointerEvent) {
        if (showNotebookDropdown && popoverContainerEl && !popoverContainerEl.contains(e.target as Node)) {
            showNotebookDropdown = false;
        }
    }

    // Quick Switcher / Filter State
    let searchInputEl: HTMLInputElement;

    // Keyboard navigation state
    let focusPane: "sections" | "pages" = "sections";
    let focusedSectionIndex: number = 0;
    let focusedPagePath: string = "";
    
    // Svelte element bindings for auto scrolling
    let modalContainerEl: HTMLElement;

    $: trimmedQuery = $filterQueryStore.trim().toLowerCase();

    // When typing query, auto focus to pages list and reset focused page path
    $: if (trimmedQuery) {
        focusPane = "pages";
        if ($filteredPages.length > 0) {
            focusedPagePath = $filteredPages[0].filepath;
        }
    }

    // =============================================
    // Lifecycle
    // =============================================
    function handleGlobalCapturePointerDown(e: PointerEvent) {
        if (!showNotebookDropdown) return;
        const target = e.target as Node | null;
        if (target && popoverContainerEl && !popoverContainerEl.contains(target)) {
            showNotebookDropdown = false;
        }
    }

    onMount(() => {
        vm.loadNotebooks();
        window.addEventListener("pointerdown", handleGlobalCapturePointerDown, true);

        // 1. Sync active note and auto-reveal active section/ancestors & subpage expansion
        const activeFile = app.workspace.getActiveFile();
        const activeFilePath = activeFile ? activeFile.path : "";
        if (activeFilePath) {
            $activePagePath = activeFilePath;
            vm.autoRevealActivePage(activeFilePath);
            
            // Fix: Actually focus the pages pane and select the active note
            focusPane = "pages";
            focusedPagePath = activeFilePath;
        }

        // Align focusedSectionIndex with current selectedSection
        syncSectionIndexToSelectedSection();

        // 2. Auto focus search input for immediate IME typing and keyboard navigation
        setTimeout(() => {
            if (searchInputEl) {
                searchInputEl.focus();
                if ($filterQueryStore) {
                    searchInputEl.select();
                }
            } else if (modalContainerEl) {
                modalContainerEl.focus();
            }
            scrollFocusedIntoView();
        }, 50);

        // 3. Listen for cross-view state sync from sidebar or other modals
        EventBus.on(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged as (payload: unknown) => void);
        EventBus.on(EventName.SECTION_SELECTED, handleSectionSelected as (payload: unknown) => void);
        EventBus.on(EventName.ORDER_CHANGED, handleOrderChanged as (payload: unknown) => void);
    });

    function handleExpandedChanged(payload: ExpandedSectionsChangedPayload) {
        if (payload.sourceId !== instanceId && payload.paths) {
            vm.expandedSections.set(new Set(payload.paths));
            vm.loadNotebooks();
        }
    }

    function handleSectionSelected(payload: SectionSelectedPayload) {
        if (payload.sourceId !== instanceId && payload.section !== undefined) {
            if (payload.section) {
                $selectedSection = payload.section;
            } else {
                $selectedSection = null;
            }
        }
    }

    function handleOrderChanged() {
        vm.loadNotebooks();
    }

    onDestroy(() => {
        window.removeEventListener("pointerdown", handleGlobalCapturePointerDown, true);
        EventBus.off(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged as (payload: unknown) => void);
        EventBus.off(EventName.SECTION_SELECTED, handleSectionSelected as (payload: unknown) => void);
        EventBus.off(EventName.ORDER_CHANGED, handleOrderChanged as (payload: unknown) => void);
        vm.destroy();
    });

    // =============================================
    // UI Actions
    // =============================================
    function selectNotebook(nb: NotebookInfo) {
        vm.selectNotebook(nb);
        if ($selectedSection) {
            onSectionSelectedChanged($selectedSection.folderPath);
        }
        showNotebookDropdown = false;
    }

    function selectSection(sec: SectionInfo) {
        vm.selectSection(sec);
        focusPane = "sections";
        const index = $visibleSections.findIndex(s => s.folderPath === sec.folderPath);
        if (index !== -1) {
            focusedSectionIndex = index;
        }
        onSectionSelectedChanged(sec.folderPath);
        EventBus.emit(EventName.SECTION_SELECTED, { section: sec, sourceId: instanceId });
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

    function toggleSection(sec: SectionInfo) {
        vm.toggleSection(sec, (paths) => {
            onExpandedChanged(paths);
            EventBus.emit(EventName.EXPANDED_SECTIONS_CHANGED, { paths, sourceId: instanceId });
        });
    }

    function openPage(page: PageInfo, inNewTab: boolean = false) {
        $activePagePath = page.filepath;
        if (inNewTab) {
            app.workspace.openLinkText(page.filepath, "", "tab");
        } else {
            app.workspace.openLinkText(page.filepath, "", false);
            onPageOpened(page.filepath);
        }
    }

    function handlePageAuxClick(e: MouseEvent, page: PageInfo) {
        if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            openPage(page, true);
        }
    }

    function handlePageContextMenu(e: MouseEvent, page: PageInfo) {
        e.preventDefault();
        e.stopPropagation();
        const activeApp = app || (window as any).app;
        
        // Calculate upward focus target before context menu action
        const visibleFlatPages = trimmedQuery ? $filteredPages : ($selectedSection ? DataService.getFlattenedPages($selectedSection.pages) : []);
        const currentIdx = visibleFlatPages.findIndex(p => p.filepath === page.filepath);
        let nextFocusPath = "";
        if (currentIdx > 0) {
            nextFocusPath = visibleFlatPages[currentIdx - 1].filepath;
        } else if (visibleFlatPages.length > 1) {
            nextFocusPath = visibleFlatPages[1].filepath;
        }

        ContextMenuHelper.showPageContextMenu(e, activeApp, page, $selectedSection?.folderPath || "", () => {
            vm.loadNotebooks();
            if (nextFocusPath) {
                focusedPagePath = nextFocusPath;
                focusPane = "pages";
                setTimeout(scrollFocusedIntoView, 10);
            }
        });
    }

    function openCurrentSelection(inNewTab: boolean = false) {
        const visibleFlatPages = trimmedQuery ? $filteredPages : ($selectedSection ? DataService.getFlattenedPages($selectedSection.pages) : []);
        if (focusPane === "pages" && visibleFlatPages.length > 0) {
            const page = visibleFlatPages.find(p => p.filepath === focusedPagePath) || visibleFlatPages[0];
            if (page) {
                openPage(page, inNewTab);
                return;
            }
        }
        
        // If focus is in sections pane
        const sec = $visibleSections[focusedSectionIndex];
        if (sec && sec.pages.length > 0) {
            openPage(sec.pages[0], inNewTab);
            return;
        }
        
        if (visibleFlatPages.length > 0) {
            openPage(visibleFlatPages[0], inNewTab);
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
                focusPane = "pages";
                focusedPagePath = newFile.path;
                openPage({ name: newFile.basename, filepath: newFile.path });
                setTimeout(scrollFocusedIntoView, 50);
            }
        }
    }

    async function handleQuickNewSection() {
        let targetFolderPath = $selectedSection?.folderPath;
        if (!targetFolderPath) {
            targetFolderPath = rootFolder.trim() !== "" ? rootFolder : "";
        }
        const activeApp = app || (window as any).app;
        if (activeApp) {
            const newFolder = await ContextMenuHelper.createNewSection(activeApp, targetFolderPath);
            if (newFolder) {
                if (targetFolderPath) {
                    vm.expandedSections.update(s => {
                        s.add(targetFolderPath);
                        return s;
                    });
                }
                vm.loadNotebooks();
                focusPane = "sections";
                const index = $visibleSections.findIndex(s => s.folderPath === newFolder.path);
                if (index !== -1) {
                    focusedSectionIndex = index;
                    $selectedSection = $visibleSections[index];
                }
                setTimeout(scrollFocusedIntoView, 50);
            }
        }
    }

    async function handleDeleteCurrentPage() {
        const visibleFlatPages = trimmedQuery ? $filteredPages : ($selectedSection ? DataService.getFlattenedPages($selectedSection.pages) : []);
        const currentIdx = visibleFlatPages.findIndex(p => p.filepath === focusedPagePath);
        if (currentIdx === -1) return;

        const pageToDelete = visibleFlatPages[currentIdx];
        let nextFocusPath = "";
        if (currentIdx > 0) {
            nextFocusPath = visibleFlatPages[currentIdx - 1].filepath;
        } else if (visibleFlatPages.length > 1) {
            nextFocusPath = visibleFlatPages[1].filepath;
        }

        const activeApp = app || (window as any).app;
        if (activeApp && pageToDelete) {
            await ContextMenuHelper.deletePageSafely(activeApp, pageToDelete);
            vm.loadNotebooks();
            if (nextFocusPath) {
                focusedPagePath = nextFocusPath;
                focusPane = "pages";
                setTimeout(scrollFocusedIntoView, 10);
            }
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        // 0. IME Composition Guard: Allow Chinese/Japanese IME candidates selection & Enter commit without interception
        if (e.isComposing || e.keyCode === 229) {
            return;
        }

        // Quick New Note shortcut: Ctrl+N / Cmd+N
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
            e.preventDefault();
            e.stopPropagation();
            handleQuickNewNote();
            return;
        }

        // Safe Delete Note shortcut: Delete / Backspace (only when focused outside search input)
        if ((e.key === "Delete" || e.key === "Backspace") && focusPane === "pages" && document.activeElement !== searchInputEl) {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteCurrentPage();
            return;
        }

        // 1. If focus is inside search input
        if (document.activeElement === searchInputEl) {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                
                if (trimmedQuery) {
                    focusPane = "pages";
                }

                if (focusPane === "sections") {
                    handleSectionsKeydown(e.key);
                } else {
                    handlePagesKeydown(e.key);
                }
                setTimeout(scrollFocusedIntoView, 10);
                return;
            } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                // If there's no query, left/right switches pane or toggles section
                if (!trimmedQuery) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (focusPane === "sections") {
                        handleSectionsKeydown(e.key);
                    } else {
                        handlePagesKeydown(e.key);
                    }
                    setTimeout(scrollFocusedIntoView, 10);
                    return;
                }
                // If query exists, allow normal text cursor movement within search input
                return;
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const inNewTab = e.ctrlKey || e.metaKey;
                openCurrentSelection(inNewTab);
                return;
            } else if (e.key === "Escape") {
                if (showNotebookDropdown) {
                    e.preventDefault();
                    e.stopPropagation();
                    showNotebookDropdown = false;
                    return;
                }
                if ($filterQueryStore) {
                    e.preventDefault();
                    e.stopPropagation();
                    $filterQueryStore = "";
                    return;
                }
                // When search box is empty, let Escape bubble to close modal naturally
                return;
            }
            return; // Allow typing characters inside search box (including Space character)
        }

        // 2. Navigation keys inside list (Arrow keys, Enter, Space)
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            const inNewTab = e.ctrlKey || e.metaKey;
            openCurrentSelection(inNewTab);
            return;
        }

        // Arrow keys -> Directional movement
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();

            if (focusPane === "sections") {
                handleSectionsKeydown(e.key);
            } else {
                handlePagesKeydown(e.key);
            }

            setTimeout(scrollFocusedIntoView, 10);
            return;
        }

        // 3. Ignore control/modifier/system hotkeys
        if (
            e.ctrlKey || e.altKey || e.metaKey || 
            ["Tab", "Escape", "Shift", "Control", "Alt", "Meta", "CapsLock", "ContextMenu"].includes(e.key) ||
            e.key.startsWith("F")
        ) {
            return;
        }

        // 4. Type ANY character key -> Auto switch focus to search input!
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Unidentified") {
            searchInputEl?.focus();
        }
    }

    function handleSectionsKeydown(key: string) {
        if ($visibleSections.length === 0) return;

        switch (key) {
            case "ArrowUp": {
                focusedSectionIndex = Math.max(0, focusedSectionIndex - 1);
                const sec = $visibleSections[focusedSectionIndex];
                if (sec) {
                    $selectedSection = sec;
                    if (sec.pages.length > 0) focusedPagePath = sec.pages[0].filepath;
                }
                break;
            }
            case "ArrowDown": {
                focusedSectionIndex = Math.min($visibleSections.length - 1, focusedSectionIndex + 1);
                const sec = $visibleSections[focusedSectionIndex];
                if (sec) {
                    $selectedSection = sec;
                    if (sec.pages.length > 0) focusedPagePath = sec.pages[0].filepath;
                }
                break;
            }
            case "ArrowRight": {
                const sec = $visibleSections[focusedSectionIndex];
                if (sec) {
                    if (sec.children.length > 0 && !sec.isExpanded) {
                        toggleSection(sec);
                    } else {
                        $selectedSection = sec;
                        if (sec.pages.length > 0) {
                            focusPane = "pages";
                            focusedPagePath = sec.pages[0].filepath;
                        }
                    }
                }
                break;
            }
            case "ArrowLeft": {
                const sec = $visibleSections[focusedSectionIndex];
                if (sec && sec.isExpanded) {
                    toggleSection(sec);
                }
                break;
            }
            case "Enter": {
                openCurrentSelection();
                break;
            }
        }
    }

    function syncSectionIndexToSelectedSection() {
        if (!$selectedSection) return;
        const currentSec = $selectedSection;
        const index = $visibleSections.findIndex(s => s.folderPath === currentSec.folderPath);
        if (index !== -1) {
            focusedSectionIndex = index;
        }
    }

    function handlePagesKeydown(key: string) {
        const visibleFlatPages = trimmedQuery ? $filteredPages : ($selectedSection ? DataService.getFlattenedPages($selectedSection.pages) : []);
        if (visibleFlatPages.length === 0) return;

        let currentIdx = visibleFlatPages.findIndex(p => p.filepath === focusedPagePath);
        if (currentIdx === -1) currentIdx = 0;

        switch (key) {
            case "ArrowUp": {
                const prevIdx = Math.max(0, currentIdx - 1);
                focusedPagePath = visibleFlatPages[prevIdx]?.filepath || "";
                break;
            }
            case "ArrowDown": {
                const nextIdx = Math.min(visibleFlatPages.length - 1, currentIdx + 1);
                focusedPagePath = visibleFlatPages[nextIdx]?.filepath || "";
                break;
            }
            case "ArrowLeft":
                if (!trimmedQuery) {
                    focusPane = "sections";
                    syncSectionIndexToSelectedSection();
                }
                break;
            case "Enter": {
                const page = visibleFlatPages.find(p => p.filepath === focusedPagePath) || visibleFlatPages[currentIdx];
                if (page) {
                    openPage(page);
                }
                break;
            }
        }
    }

    function scrollFocusedIntoView() {
        const selector = focusPane === "sections" ? ".on-sections-pane .on-focused" : ".on-pages-pane .on-focused";
        const el = modalContainerEl?.querySelector(selector) as HTMLElement | null;
        if (el) {
            el.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
    }
</script>

<svelte:window on:click={handleWindowClick} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
    class="on-modal-container" 
    bind:this={modalContainerEl}
    on:keydown={handleKeydown}
    on:pointerdown={handleContainerPointerDown}
    tabindex="0"
    style="outline: none;"
    role="region"
>
    {#if showTip}
        <div class="on-tip-banner">
            <span>💡 Tip: Set a hotkey under Settings → Hotkeys → "Fluent OneNote: Open navigation popup" for instant access ({remainingTips} reminders left)</span>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <span class="on-tip-guide-link" role="button" tabindex="0" on:click={() => showGuideModal = true}>⚡ Features Guide</span>
        </div>
    {/if}

    <!-- Quick Switcher Filter Bar -->
    <div class="on-filter-bar">
        <span class="on-filter-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="2" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </span>
        <input 
            type="text" 
            class="on-filter-input" 
            placeholder={$searchAllNotebooks ? "Search across all notebooks..." : ($selectedNotebook ? `Search in "${$selectedNotebook.name}"...` : "Type to search page or section...")} 
            bind:value={$filterQueryStore}
            bind:this={searchInputEl}
        />
        {#if $filterQueryStore}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <span class="on-filter-clear" on:click={() => $filterQueryStore = ""} role="button" tabindex="0" title="Clear search">✕</span>
        {/if}
        <!-- Global Search Toggle Button -->
        <button 
            type="button"
            class="on-filter-btn-global" 
            class:active={$searchAllNotebooks}
            on:click={toggleGlobalSearch}
            title={$searchAllNotebooks 
                ? "Search Scope: All Notebooks (Click to switch to Current Notebook)" 
                : `Search Scope: Current Notebook (${$selectedNotebook ? $selectedNotebook.name : "Active"}) (Click to switch to All Notebooks)`}
        >
            {#if $searchAllNotebooks}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span class="on-filter-btn-label">All</span>
            {:else}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                </svg>
                <span class="on-filter-btn-label">Current</span>
            {/if}
        </button>

        <!-- Features & Shortcuts Guide Trigger Button -->
        <button 
            type="button" 
            class="on-btn-guide" 
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
    </div>

    <div class="on-dual-pane">
        {#if !$rootFolderExists}
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
            <!-- Pane 1: Sections (分区) with Header Notebook Selector -->
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
                                    <NotebookTreeItem notebook={nb} onSelect={selectNotebook} />
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
                <div class="on-list">
                    {#if $sections.length === 0}
                        <div class="on-empty-msg">No sections found.</div>
                    {/if}
                    
                    {#each $sections as sec (sec.folderPath)}
                        <SectionTreeItem 
                            {sec} 
                            {focusPane}
                            focusedFolderPath={focusPane === "sections" && $visibleSections[focusedSectionIndex] ? $visibleSections[focusedSectionIndex].folderPath : ""}
                        />
                    {/each}
                </div>
            </div>

            <!-- Pane 2: Pages/Notes in Selected Section -->
            <div class="on-pages-pane">
                <div class="on-pane-header on-pane-header-with-action">
                    <span>{trimmedQuery ? `Matches (${$filteredPages.length})` : "Pages"}</span>
                    <button 
                        class="on-btn-quick-add" 
                        title="New Note in section (Ctrl+N)"
                        on:click={() => handleQuickNewNote()}
                    >
                        + New Page
                    </button>
                </div>
                <div class="on-list" on:scroll={(e) => scrollTop = e.currentTarget.scrollTop}>
                    {#if $filteredPages.length > 0}
                        {#if visibleRange.topPadding > 0}
                            <div style="height: {visibleRange.topPadding}px;"></div>
                        {/if}
                        {#each visibleRange.pages as page (page.filepath)}
                            <PageTreeItem 
                                {page}
                                depth={0}
                                {focusPane}
                                {focusedPagePath}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                            />
                        {/each}
                        {#if visibleRange.bottomPadding > 0}
                            <div style="height: {visibleRange.bottomPadding}px;"></div>
                        {/if}
                    {:else if trimmedQuery}
                        <div class="on-empty-msg">No matching pages for "{$filterQueryStore}".</div>
                    {:else if $selectedSection}
                        <div class="on-empty-msg">No pages in this section.</div>
                    {:else}
                        <div class="on-empty-msg">Select a section to view pages.</div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

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
