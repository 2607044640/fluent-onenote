<script lang="ts">
    import { onMount, onDestroy, getContext, tick } from "svelte";
    import type { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { ContextMenuHelper } from "./ContextMenuHelper";
    import { NotebookInfo } from "./types";

    export let notebook: NotebookInfo;
    export let onSelect: (nb: NotebookInfo) => void = () => {};

    const vm = getContext<OneNoteViewModel>("vm");

    const selectedNotebook = vm.selectedNotebook;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;

    let isEditing = false;
    let editName = notebook.name;
    let isHovered = false;
    let inputEl: HTMLInputElement;

    const editingNotebookPath = vm.editingNotebookPath;

    $: if (!isEditing) {
        editName = notebook.name;
    }

    $: if ($editingNotebookPath === notebook.folderPath && !isEditing) {
        startInlineRename();
        vm.editingNotebookPath.set(null);
    }

    async function startInlineRename() {
        editName = notebook.name;
        isEditing = true;
        await tick();
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
            inputEl.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
    }

    async function commitRename(closeOnEnter: boolean = false) {
        if (!isEditing) return;
        const trimmed = editName.trim();
        if (!trimmed || trimmed === notebook.name) {
            cancelRename();
            if (closeOnEnter) {
                vm.selectNotebook(notebook);
                onSelect(notebook);
            }
            return;
        }
        isEditing = false;
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            const success = await ContextMenuHelper.renameNotebook(activeApp, notebook, trimmed);
            if (success) {
                const parentDir = notebook.folderPath.includes("/") 
                    ? notebook.folderPath.substring(0, notebook.folderPath.lastIndexOf("/")) 
                    : "";
                const newPath = parentDir ? `${parentDir}/${trimmed}` : trimmed;
                const updatedNb: NotebookInfo = { ...notebook, folderPath: newPath, name: trimmed };
                if ($selectedNotebook && $selectedNotebook.folderPath === notebook.folderPath) {
                    $selectedNotebook = updatedNb;
                }
                vm.loadNotebooks(undefined, newPath);
                if (closeOnEnter) {
                    vm.selectNotebook(updatedNb);
                    onSelect(updatedNb);
                }
            }
        }
    }

    function cancelRename() {
        editName = notebook.name;
        isEditing = false;
    }

    function handleInputKeydown(e: KeyboardEvent) {
        e.stopPropagation();
        if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            commitRename(true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRename();
        }
    }

    function handleInputBlur() {
        commitRename(false);
    }

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            ContextMenuHelper.showNotebookContextMenu(
                e, 
                activeApp, 
                notebook, 
                () => vm.loadNotebooks(), 
                () => startInlineRename()
            );
        }
    }

    function handleWindowKeydown(e: KeyboardEvent) {
        if (e.key === "F2" && isHovered && !isEditing) {
            e.preventDefault();
            e.stopPropagation();
            startInlineRename();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleWindowKeydown);
        if ($editingNotebookPath === notebook.folderPath && !isEditing) {
            startInlineRename();
            vm.editingNotebookPath.set(null);
        }
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleWindowKeydown);
    });

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
        draggable={!isEditing}
        on:mouseenter={() => isHovered = true}
        on:mouseleave={() => isHovered = false}
        on:dragstart={(e) => !isEditing && vm.handleDragStart(e, notebook.folderPath, "notebook")}
        on:dragover|stopPropagation={(e) => !isEditing && vm.handleDragOver(e, notebook.folderPath, "notebook")}
        on:dragleave={(e) => !isEditing && vm.handleDragLeave(e, notebook.folderPath)}
        on:drop|stopPropagation={(e) => !isEditing && vm.handleDrop(e, notebook.folderPath, "notebook")}
        on:dragend={() => vm.handleDragEnd()}
        on:click={() => {
            if (!isEditing) {
                vm.selectNotebook(notebook);
                onSelect(notebook);
            }
        }}
        on:contextmenu={handleContextMenu}
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
            <span class="on-name">{notebook.name}</span>
        {/if}
        <span class="on-count">{notebook.sections.length}</span>
    </div>
</div>
