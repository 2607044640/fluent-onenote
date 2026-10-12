<script lang="ts">
    import type { NotebookInfo } from "./types";
    import NotebookTreeItem from "./NotebookTreeItem.svelte";

    export let show: boolean = false;
    export let notebooks: NotebookInfo[] = [];
    export let onSelect: (nb: NotebookInfo) => void = () => {};
    export let onNewNotebook: () => void = () => {};
    export let onClose: () => void = () => {};
</script>

{#if show}
    <div class="on-notebook-popover">
        <div class="on-popover-header">
            <span>Notebooks ({notebooks.length})</span>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <span 
                class="on-btn-quick-add" 
                style="cursor: pointer;" 
                role="button"
                tabindex="0"
                on:keydown={async (e) => { if (e.key === 'Enter') { await onNewNotebook(); onClose(); } }}
                on:click|stopPropagation={async () => { await onNewNotebook(); onClose(); }}
            >
                + New
            </span>
        </div>
        <div class="on-popover-list">
            {#if notebooks.length === 0}
                <div class="on-empty-msg">No notebooks found.</div>
            {/if}
            {#each notebooks as nb (nb.folderPath)}
                <NotebookTreeItem notebook={nb} {onSelect} />
            {/each}
        </div>
    </div>
{/if}
