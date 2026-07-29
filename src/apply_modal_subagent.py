import os

view_path = r'C:\ObsidianDev\plugins\A1OneNote\src\OneNoteModalView.svelte'

with open(view_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the <script> block
script_start = content.find('<script lang="ts">')
script_end = content.find('</script>') + len('</script>')

new_script = """<script lang="ts">
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
    const visibleSections = vm.visibleSections;
    const filteredPages = vm.filteredPages;

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
        }

        // Align focusedSectionIndex with current selectedSection
        syncSectionIndexToSelectedSection();

        // 2. Auto focus modal container for immediate keyboard navigation
        setTimeout(() => {
            if (modalContainerEl) {
                modalContainerEl.focus();
            }
            scrollFocusedIntoView();
        }, 50);

        // 3. Listen for cross-view state sync from sidebar or other modals
        EventBus.on(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged);
        EventBus.on(EventName.SECTION_SELECTED, handleSectionSelected);
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

    onDestroy(() => {
        window.removeEventListener("pointerdown", handleGlobalCapturePointerDown, true);
        EventBus.off(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged);
        EventBus.off(EventName.SECTION_SELECTED, handleSectionSelected);
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
                openPage({ name: newFile.basename, filepath: newFile.path, ctime: newFile.stat.ctime, mtime: newFile.stat.mtime });
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

    // =============================================
    // Keyboard Navigation
    // =============================================
    function handleKeydown(e: KeyboardEvent) {
        // Quick New Note shortcut: Ctrl+N / Cmd+N
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
            e.preventDefault();
            e.stopPropagation();
            handleQuickNewNote();
            return;
        }

        // Safe Delete Note shortcut: Delete / Backspace
        if ((e.key === "Delete" || e.key === "Backspace") && focusPane === "pages" && document.activeElement !== searchInputEl) {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteCurrentPage();
            return;
        }
        // 1. If focus is inside search input
        if (document.activeElement === searchInputEl) {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                // Direction keys exit search input to focus navigation below
                e.preventDefault();
                e.stopPropagation();
                searchInputEl.blur();
                modalContainerEl?.focus();
                
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
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const inNewTab = e.ctrlKey || e.metaKey;
                openCurrentSelection(inNewTab);
                return;
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (showNotebookDropdown) {
                    showNotebookDropdown = false;
                    return;
                }
                if ($filterQueryStore) {
                    $filterQueryStore = "";
                    searchInputEl.blur();
                    modalContainerEl?.focus();
                }
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
        const index = $visibleSections.findIndex(s => s.folderPath === $selectedSection.folderPath);
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
</script>"""

html = content[script_end:]

# a. Search bar binding
html = html.replace('bind:value={filterQuery}', 'bind:value={$filterQueryStore}')
html = html.replace('{#if filterQuery}', '{#if $filterQueryStore}')
html = html.replace('on:click={() => filterQuery = ""}', 'on:click={() => $filterQueryStore = ""}')

# b. rootFolderExists
html = html.replace('{#if !rootFolderExists}', '{#if !$rootFolderExists}')

# c. selectedNotebook and notebooks
html = html.replace('{selectedNotebook ? selectedNotebook.name : "Select Notebook"}', '{$selectedNotebook ? $selectedNotebook.name : "Select Notebook"}')
html = html.replace('Notebooks ({notebooks.length})', 'Notebooks ({$notebooks.length})')
html = html.replace('{#if notebooks.length === 0}', '{#if $notebooks.length === 0}')
html = html.replace('{#each notebooks as nb (nb.folderPath)}', '{#each $notebooks as nb (nb.folderPath)}')

html = html.replace('''                                <NotebookTreeItem 
                                    notebook={nb}
                                    {selectedNotebook}
                                    {app}
                                    {draggedItemId}
                                    {dragOverId}
                                    {dragPosition}
                                    onSelect={selectNotebook}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDragEnd}
                                />''', '''                                <NotebookTreeItem notebook={nb} />''')

# d. sections
html = html.replace('{#if sections.length === 0}', '{#if $sections.length === 0}')
html = html.replace('{#each sections as sec (sec.folderPath)}', '{#each $sections as sec (sec.folderPath)}')

html = html.replace('''                        <SectionTreeItem 
                            {sec} 
                            {selectedSection}
                            {app}
                            {plugin}
                            {draggedItemId}
                            {dragOverId}
                            {dragPosition}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            onRefresh={() => loadNotebooks()}
                            onSelect={selectSection}
                            {focusPane}
                            focusedFolderPath={focusPane === "sections" && visibleSections[focusedSectionIndex] ? visibleSections[focusedSectionIndex].folderPath : ""}
                        />''', '''                        <SectionTreeItem 
                            {sec} 
                            {focusPane}
                            focusedFolderPath={focusPane === "sections" && $visibleSections[focusedSectionIndex] ? $visibleSections[focusedSectionIndex].folderPath : ""}
                        />''')


# e. filteredPages
html = html.replace('<span>{trimmedQuery ? `Matches (${filteredPages.length})` : "Pages"}</span>', '<span>{trimmedQuery ? `Matches (${$filteredPages.length})` : "Pages"}</span>')
html = html.replace('{#if filteredPages.length > 0}', '{#if $filteredPages.length > 0}')

html = html.replace('''                            <PageTreeItem 
                                {page}
                                depth={0}
                                {activePagePath}
                                {app}
                                {plugin}
                                sectionFolderPath={selectedSection ? selectedSection.folderPath : ""}
                                visiblePages={selectedSection ? selectedSection.pages : []}
                                {draggedItemId}
                                {dragOverId}
                                {dragPosition}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragEnd={handleDragEnd}
                                onRefresh={() => loadNotebooks()}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                                {focusPane}
                                {focusedPagePath}
                            />''', '''                            <PageTreeItem 
                                {page}
                                depth={0}
                                {focusPane}
                                {focusedPagePath}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                            />''')

# f. fallback messages
html = html.replace('No matching pages for "{filterQuery}".', 'No matching pages for "{$filterQueryStore}".')
html = html.replace('{:else if selectedSection}', '{:else if $selectedSection}')

with open(view_path, 'w', encoding='utf-8') as f:
    f.write(new_script + html)

print("OneNoteModalView successfully updated via Python script based on Subagent output!")
