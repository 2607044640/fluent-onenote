<script lang="ts">
    import { getContext } from "svelte";
    import type { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { NotebookInfo } from "./types";

    export let notebook: NotebookInfo;

    const vm = getContext<OneNoteViewModel>("vm");

    const selectedNotebook = vm.selectedNotebook;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    function getRecursiveSectionPageCount(nb: NotebookInfo): number {
        let count = 0;
        if (nb.sections) {
            for (const sec of nb.sections) {
                count += sec.pages.length;
            }
        }
        return count;
    }
</script>

<div class="on-notebook-wrapper">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div 
        class="on-item on-notebook-item"
        class:active={$selectedNotebook && $selectedNotebook.folderPath === notebook.folderPath}
        class:drag-over-top={$dragOverId === notebook.folderPath && $dragPosition === "top"}
        class:drag-over-bottom={$dragOverId === notebook.folderPath && $dragPosition === "bottom"}
        class:is-dragging={$draggedItemId === notebook.folderPath}
        draggable="true"
        on:dragstart={(e) => vm.handleDragStart(e, notebook.folderPath, "notebook")}
        on:dragover|stopPropagation={(e) => vm.handleDragOver(e, notebook.folderPath, "notebook")}
        on:dragleave={(e) => vm.handleDragLeave(e, notebook.folderPath)}
        on:drop|stopPropagation={(e) => vm.handleDrop(e, notebook.folderPath, "notebook")}
        on:dragend={() => vm.handleDragEnd()}
        on:click={() => vm.selectNotebook(notebook)}
        role="button"
        tabindex="0"
    >
        <!-- Notebook Book Icon -->
        <span class="on-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/>
                <path d="M6 10h10"/>
            </svg>
        </span>
        
        <span class="on-name">{notebook.name}</span>
        <span class="on-count">{notebook.sections.length}</span>
    </div>
</div>
