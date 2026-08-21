<script lang="ts">
    import { getContext } from "svelte";
    import type { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { type PageInfo } from "./types";

    export let page: PageInfo;
    export let depth: number = 0;
    export let focusPane: "sections" | "pages" = "sections";
    export let focusedPagePath: string = "";
    
    // Callbacks
    export let onClick: (page: PageInfo, inNewTab: boolean) => void = () => {};
    export let onAuxClick: (e: MouseEvent, page: PageInfo) => void = () => {};
    export let onContextMenu: (e: MouseEvent, page: PageInfo) => void = () => {};

    const vm = getContext<OneNoteViewModel>("vm");

    const activePagePath = vm.activePagePath;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    $: isFocused = focusPane === "pages" && focusedPagePath === page.filepath;

    function handleChevronClick(e: MouseEvent) {
        e.stopPropagation();
        page.isExpanded = !page.isExpanded;
        page = { ...page };
    }
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
        draggable="true"
        on:dragstart={(e) => vm.handleDragStart(e, page.filepath, "page")}
        on:dragover|stopPropagation={(e) => vm.handleDragOver(e, page.filepath, "page")}
        on:dragleave={(e) => vm.handleDragLeave(e, page.filepath)}
        on:drop|stopPropagation={(e) => vm.handleDrop(e, page.filepath, "page")}
        on:dragend={() => vm.handleDragEnd()}
        on:click={(e) => {
            const inNewTab = e.ctrlKey || e.metaKey;
            onClick(page, inNewTab);
        }}
        on:auxclick={(e) => onAuxClick(e, page)}
        on:contextmenu={(e) => onContextMenu(e, page)}
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

        <!-- Note Name -->
        <span class="on-name">{page.name}</span>
        
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
                {onContextMenu}
            />
        {/each}
    {/if}
</div>
