<script lang="ts">
    import { getContext } from "svelte";
    import type { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { ContextMenuHelper } from "./ContextMenuHelper";
    import { SectionInfo } from "./types";

    export let sec: SectionInfo;
    export let focusPane: "sections" | "pages" | "notebooks" = "sections";
    export let focusedFolderPath: string = "";

    const vm = getContext<OneNoteViewModel>("vm");

    const selectedSection = vm.selectedSection;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    function handleRowClick() {
        vm.selectSection(sec);
    }

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            ContextMenuHelper.showSectionContextMenu(e, activeApp, sec, () => vm.loadNotebooks());
        }
    }
</script>

<div class="on-section-wrapper">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div 
        class="on-item on-section-item"
        class:active={$selectedSection && $selectedSection.folderPath === sec.folderPath}
        class:on-focused={focusPane === "sections" && focusedFolderPath === sec.folderPath}
        class:drag-over-top={$dragOverId === sec.folderPath && $dragPosition === "top"}
        class:drag-over-bottom={$dragOverId === sec.folderPath && $dragPosition === "bottom"}
        class:is-dragging={$draggedItemId === sec.folderPath}
        draggable="true"
        on:dragstart={(e) => vm.handleDragStart(e, sec.folderPath, "section")}
        on:dragover|stopPropagation={(e) => vm.handleDragOver(e, sec.folderPath, "section")}
        on:dragleave={(e) => vm.handleDragLeave(e, sec.folderPath)}
        on:drop|stopPropagation={(e) => vm.handleDrop(e, sec.folderPath, "section")}
        on:dragend={() => vm.handleDragEnd()}
        on:click={handleRowClick}
        on:contextmenu={handleContextMenu}
        role="button"
        tabindex="0"
    >
        <!-- Folder Icon -->
        <span class="on-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
            </svg>
        </span>
        
        <span class="on-name">{sec.name}</span>
        <span class="on-count">{sec.pages.length}</span>
    </div>
</div>
