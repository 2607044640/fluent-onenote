<script lang="ts">
    import { onMount, onDestroy, getContext, tick } from "svelte";
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

    let isEditing = false;
    let editName = sec.name;
    let isHovered = false;
    let inputEl: HTMLInputElement;

    $: isFocused = focusPane === "sections" && focusedFolderPath === sec.folderPath;

    $: if (!isEditing) {
        editName = sec.name;
    }

    async function startInlineRename() {
        editName = sec.name;
        isEditing = true;
        await tick();
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    }

    async function commitRename() {
        if (!isEditing) return;
        const trimmed = editName.trim();
        if (!trimmed || trimmed === sec.name) {
            cancelRename();
            return;
        }
        isEditing = false;
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            const success = await ContextMenuHelper.renameSection(activeApp, sec, trimmed);
            if (success) {
                if ($selectedSection && $selectedSection.folderPath === sec.folderPath) {
                    const parentDir = sec.folderPath.includes("/") 
                        ? sec.folderPath.substring(0, sec.folderPath.lastIndexOf("/")) 
                        : "";
                    const newPath = parentDir ? `${parentDir}/${trimmed}` : trimmed;
                    $selectedSection = { ...$selectedSection, folderPath: newPath, name: trimmed };
                }
                vm.loadNotebooks();
            }
        }
    }

    function cancelRename() {
        editName = sec.name;
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

    function handleRowClick() {
        if (!isEditing) {
            vm.selectSection(sec);
        }
    }

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const activeApp = vm.app || (window as any).app;
        if (activeApp) {
            ContextMenuHelper.showSectionContextMenu(
                e, 
                activeApp, 
                sec, 
                () => vm.loadNotebooks(),
                () => startInlineRename()
            );
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

<div class="on-section-wrapper">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div 
        class="on-item on-section-item"
        class:active={$selectedSection && $selectedSection.folderPath === sec.folderPath}
        class:on-focused={isFocused}
        class:drag-over-top={$dragOverId === sec.folderPath && $dragPosition === "top"}
        class:drag-over-bottom={$dragOverId === sec.folderPath && $dragPosition === "bottom"}
        class:is-dragging={$draggedItemId === sec.folderPath}
        draggable={!isEditing}
        on:mouseenter={() => isHovered = true}
        on:mouseleave={() => isHovered = false}
        on:dragstart={(e) => !isEditing && vm.handleDragStart(e, sec.folderPath, "section")}
        on:dragover|stopPropagation={(e) => !isEditing && vm.handleDragOver(e, sec.folderPath, "section")}
        on:dragleave={(e) => !isEditing && vm.handleDragLeave(e, sec.folderPath)}
        on:drop|stopPropagation={(e) => !isEditing && vm.handleDrop(e, sec.folderPath, "section")}
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
            <span class="on-name">{sec.name}</span>
        {/if}
        <span class="on-count">{sec.pages.length}</span>
    </div>
</div>
