<script lang="ts">
    import { GUIDE_QUICK_ITEMS } from "./guideData";

    export let show: boolean = false;
    export let x: number = 0;
    export let y: number = 0;
    export let rootFolder: string = "";
    export let onOpenFullGuide: () => void = () => {};
    export let onMouseEnter: () => void = () => {};
    export let onMouseLeave: () => void = () => {};
</script>

{#if show}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
        class="on-guide-hover-popover"
        style="top: {y}px; left: {x}px;"
        on:mouseenter={onMouseEnter}
        on:mouseleave={onMouseLeave}
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
            <span class="on-guide-popover-link" role="button" tabindex="0" on:click={onOpenFullGuide}>
                Click for full guide
            </span>
        </div>
        <div class="on-guide-scope-banner">
            <span class="on-guide-scope-label">Root Scope:</span>
            <span class="on-guide-scope-val">{rootFolder.trim() ? `📁 ${rootFolder.trim()}` : "🌐 Entire Vault"}</span>
        </div>
        <div class="on-guide-popover-list">
            {#each GUIDE_QUICK_ITEMS as item}
                <div class="on-guide-item">
                    <span class="on-guide-key">{item.key}</span>
                    <span class="on-guide-desc">{item.desc}</span>
                </div>
            {/each}
        </div>
    </div>
{/if}
