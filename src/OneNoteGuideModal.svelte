<script lang="ts">
    import { GUIDE_SECTIONS } from "./guideData";

    export let show: boolean = false;
    export let onClose: () => void = () => {};
</script>

{#if show}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="on-guide-modal-backdrop" on:click={(e) => e.target === e.currentTarget && onClose()} role="presentation">
        <div class="on-guide-modal-dialog" role="dialog" aria-modal="true" tabindex="-1">
            <div class="on-guide-modal-header">
                <div class="on-guide-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>Fluent OneNote Features & Shortcuts Guide</span>
                </div>
                <span class="on-guide-modal-close" on:click={onClose} role="button" tabindex="0" title="Close Guide">✕</span>
            </div>
            <div class="on-guide-modal-body">
                {#each GUIDE_SECTIONS as section}
                    <div class="on-guide-section">
                        <div class="on-guide-section-title">{section.title}</div>
                        <div class="on-guide-grid">
                            {#each section.cards as card}
                                <div class="on-guide-card">
                                    <div class="on-guide-card-header">
                                        <span class="on-guide-badge-pill">{card.badge}</span>
                                        {card.title}
                                    </div>
                                    <div class="on-guide-card-body">
                                        {@html card.description}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}
