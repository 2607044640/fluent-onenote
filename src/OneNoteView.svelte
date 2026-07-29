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
    });

    onDestroy(() => {
        window.removeEventListener("pointerdown", handleGlobalCapturePointerDown, true);
        vaultEventRefs.forEach(ref => app.vault.offref(ref));
        app.workspace.off("file-open", handleActiveLeafChange);
        EventBus.off(EventName.EXPANDED_SECTIONS_CHANGED, handleExpandedChanged);
        EventBus.off(EventName.SECTION_SELECTED, handleSectionSelected);
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

                <!-- Notebook Popover Dropdown Menu -->
                {#if showNotebookDropdown}
                    <div class="on-notebook-popover">
                        <div class="on-popover-header">
                            <span>Notebooks ({$notebooks.length})</span>
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <span 
                                class="on-btn-quick-add" 
                                style="cursor: pointer;" 
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
</div>
