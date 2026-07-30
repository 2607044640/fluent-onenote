import { Modal, App } from "obsidian";
import OneNoteModalView from "./OneNoteModalView.svelte";
import { DataService } from "./DataService";
import type FluentOneNotePlugin from "./main";

const MAX_TIP_COUNT = 5;

export class OneNoteModal extends Modal {
    private component: OneNoteModalView | null = null;
    private plugin: FluentOneNotePlugin;
    private dataService: DataService;

    constructor(app: App, plugin: FluentOneNotePlugin, dataService: DataService) {
        super(app);
        this.plugin = plugin;
        this.dataService = dataService;
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        contentEl.empty();
        
        modalEl.addClass("on-modal");

        // 1. Detect if the user has already bound a hotkey for this command
        const pluginId = this.plugin.manifest.id; // "a1-onenote"
        const commandId = `${pluginId}:open-onenote-popup`;
        interface AppWithHotkeys extends App {
            hotkeyManager?: { customKeys?: Record<string, string[]> };
        }
        const customHotkeys = (this.app as unknown as AppWithHotkeys).hotkeyManager?.customKeys?.[commandId];
        const hotkeyAlreadySet = customHotkeys && customHotkeys.length > 0;

        // If hotkey is set, never show the tip (and don't increment counter)
        const showTip = !hotkeyAlreadySet && this.plugin.settings.tipShownCount < MAX_TIP_COUNT;
        const remainingTips = MAX_TIP_COUNT - this.plugin.settings.tipShownCount;

        this.component = new OneNoteModalView({
            target: contentEl,
            props: {
                app: this.app,
                plugin: this.plugin,
                dataService: this.dataService,
                rootFolder: this.plugin.settings.rootFolder,
                enableVirtualization: this.plugin.settings.enableDOMVirtualization ?? false,
                showTip,
                remainingTips,
                initialExpandedPaths: this.plugin.settings.expandedPaths,
                initialSelectedSectionPath: this.plugin.settings.selectedSectionPath,
                onExpandedChanged: (paths: string[]) => {
                    this.plugin.settings.expandedPaths = paths;
                    void this.plugin.saveSettings();
                },
                onSectionSelectedChanged: (path: string) => {
                    this.plugin.settings.selectedSectionPath = path;
                    void this.plugin.saveSettings();
                },
                onPageOpened: (filepath: string) => {
                    // Record in recent pages upon selection
                    this.plugin.recordRecentPage(filepath);
                    this.close();
                },
            },
        });

        // Only increment the counter if the tip banner was actually shown
        if (showTip) {
            this.plugin.settings.tipShownCount++;
            void this.plugin.saveSettings();
        }
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
