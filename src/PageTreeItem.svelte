<script lang="ts">
    import { onMount, onDestroy, getContext, tick } from "svelte";
    import type { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { ContextMenuHelper } from "./ContextMenuHelper";
    import { type PageInfo } from "./types";

    export let page: PageInfo;
    export let depth: number = 0;
    export let focusPane: "sections" | "pages" = "sections";
    export let focusedPagePath: string = "";
    
    // Callbacks
    export let onClick: (page: PageInfo, inNewTab: boolean) => void = () => {};
    export let onAuxClick: (e: MouseEvent, page: PageInfo) => void = () => {};
    export let onContextMenu: ((e: MouseEvent, page: PageInfo, onRename?: () => void) => void) | null = null;

    const vm = getContext<OneNoteViewModel>("vm");

    const activePagePath = vm.activePagePath;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    let isEditing = false;
    let editName = page.name;
    let isHovered = false;
    let inputEl: HTMLInputElement;

    $: isFocused = focusPane === "pages" && focusedPagePath === page.filepath;

    $: if (!isEditing) {
        editName = page.name;
    }

    async function startInlineRename() {
        editName = page.name;
        isEditing = true;
        await tick();
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    }

    async function commitRename() {
        if (!isEditing) return;
        const trimmed = editName.replace(/\.md$/i, "").trim();
        if (!trimmed || trimmed === page.name) {
            cancelRename();
            return;
        }
        isEditing = false;
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            const success = await ContextMenuHelper.renamePage(activeApp, page, trimmed);
            if (success) {
                vm.loadNotebooks();
            }
        }
    }

    function cancelRename() {
        editName = page.name;
        isEditing = false;
    }

    function handleInputKeydown(e: KeyboardEvent) {
        e.stopPropagation();
        if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            commitRename();
        } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRename();
        }
    }

    function handleInputBlur() {
        commitRename();
    }

    function handleChevronClick(e: MouseEvent) {
        e.stopPropagation();
        page.isExpanded = !page.isExpanded;
        page = { ...page };
    }

    function handleItemContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
            onContextMenu(e, page, () => startInlineRename());
        } else {
            const activeApp = vm.app || (window as any).app;
            if (activeApp) {
                ContextMenuHelper.showPageContextMenu(
                    e, 
                    activeApp, 
                    page, 
                    "", 
                    () => vm.loadNotebooks(),
                    () => startInlineRename()
                );
            }
        }
    }

    function handleWindowKeydown(e: KeyboardEvent) {
        if (e.key === "F2" && (isHovered || isFocused) && !isEditing) {
            e.preventDefault();
            e.stopPropagation();
            startInlineRename();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleWindowKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleWindowKeydown);
    });
</script>

<div class="on-page-wrapper">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div 
        class="on-item on-page-item"
        class:active={$activePagePath === page.filepath}
        class:on-focused={isFocused}
        class:drag-over-top={$dragOverId === page.filepath && $dragPosition === "top"}
        class:drag-over-bottom={$dragOverId === page.filepath && $dragPosition === "bottom"}
        class:is-dragging={$draggedItemId === page.filepath}
        style="padding-left: {depth * 14 + 10}px;"
        draggable={!isEditing}
        on:mouseenter={() => isHovered = true}
        on:mouseleave={() => isHovered = false}
        on:dragstart={(e) => !isEditing && vm.handleDragStart(e, page.filepath, "page")}
        on:dragover|stopPropagation={(e) => !isEditing && vm.handleDragOver(e, page.filepath, "page")}
        on:dragleave={(e) => !isEditing && vm.handleDragLeave(e, page.filepath)}
        on:drop|stopPropagation={(e) => !isEditing && vm.handleDrop(e, page.filepath, "page")}
        on:dragend={() => vm.handleDragEnd()}
        on:click={(e) => {
            if (!isEditing) {
                const inNewTab = e.ctrlKey || e.metaKey;
                onClick(page, inNewTab);
            }
        }}
        on:auxclick={(e) => !isEditing && onAuxClick(e, page)}
        on:contextmenu={handleItemContextMenu}
        role="button"
        tabindex="0"
    >
        <!-- Sub-page expansion chevron -->
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <span 
            class="on-chevron" 
            class:expanded={page.isExpanded}
            class:visible={page.children && page.children.length > 0}
            on:click={handleChevronClick}
            role="button"
            tabindex="0"
        >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </span>

        <!-- Note File Icon -->
        <span class="on-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
        </span>

        <!-- Note Name / Inline Rename Input -->
        {#if isEditing}
            <input 
                type="text" 
                class="on-rename-input" 
                bind:this={inputEl}
                bind:value={editName}
                on:click|stopPropagation
                on:mousedown|stopPropagation
                on:pointerdown|stopPropagation
                on:keydown={handleInputKeydown}
                on:blur={handleInputBlur}
            />
        {:else}
            <span class="on-name">{page.name}</span>
        {/if}
        
        {#if page.sectionName}
            <span class="on-section-tag">{page.sectionName}</span>
        {/if}
    </div>

    <!-- Render Sub-Pages recursively -->
    {#if page.isExpanded && page.children && page.children.length > 0}
        {#each page.children as child (child.filepath)}
            <svelte:self 
                page={child}
                depth={depth + 1}
                {focusPane}
                {focusedPagePath}
                {onClick}
                {onAuxClick}
                onContextMenu={onContextMenu}
            />
        {/each}
    {/if}
</div>
