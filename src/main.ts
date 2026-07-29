/**
 * main.ts
 * Fluent OneNote plugin entry point — registers views, commands, and manages plugin lifecycle.
 */

import { Plugin, ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SECTIONS } from "./types";
import { MAX_RECENT_PAGES } from "./constants";
import { Logger } from "./Logger";
import { DataService } from "./DataService";
import OneNoteView from "./OneNoteView.svelte";
import { OneNoteModal } from "./OneNoteModal";
import { RecentPagesModal } from "./RecentPagesModal";
import { FluentOneNoteSettings, DEFAULT_SETTINGS, FluentOneNoteSettingTab } from "./settings";
import "./styles.css";

// =============================================
// Svelte View Wrapper (Obsidian ItemView → Svelte)
// =============================================

class OneNoteViewWrapper extends ItemView {
    private component: OneNoteView | null = null;
    private dataService: DataService;
    private plugin: FluentOneNotePlugin;

    constructor(leaf: WorkspaceLeaf, dataService: DataService, plugin: FluentOneNotePlugin) {
        super(leaf);
        this.dataService = dataService;
        this.plugin = plugin;
    }

    getViewType(): string { return VIEW_TYPE_SECTIONS; }
    getDisplayText(): string { return "Fluent OneNote"; }
    getIcon(): string { return "layers"; }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        const settings = this.plugin.settings || DEFAULT_SETTINGS;
        this.component = new OneNoteView({
            target: container,
            props: { 
                app: this.app, 
                plugin: this.plugin,
                dataService: this.dataService,
                rootFolder: settings.rootFolder ?? "OneNote",
                enableVirtualization: settings.enableDOMVirtualization ?? false,
                initialExpandedPaths: settings.expandedPaths ?? [],
                initialSelectedSectionPath: settings.selectedSectionPath ?? "",
                onExpandedChanged: (paths: string[]) => {
                    if (this.plugin.settings) {
                        this.plugin.settings.expandedPaths = paths;
                        void this.plugin.saveSettings();
                    }
                },
                onSectionSelectedChanged: (path: string) => {
                    if (this.plugin.settings) {
                        this.plugin.settings.selectedSectionPath = path;
                        void this.plugin.saveSettings();
                    }
                },
                onPageOpened: (filepath: string) => {
                    this.plugin.recordRecentPage(filepath);
                }
            },
        });
    }

    async onClose(): Promise<void> {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }

    /** Keep props synchronized if settings change */
    updateRootFolder(rootFolder: string) {
        if (this.component) {
            this.component.$set({ rootFolder });
        }
    }
}

// =============================================
// Plugin Main Class
// =============================================

export default class FluentOneNotePlugin extends Plugin {
    private dataService!: DataService;
    settings!: FluentOneNoteSettings;

    async onload(): Promise<void> {
        Logger.init(this.app);
        void Logger.log("Fluent OneNote plugin loading...");

        window.addEventListener('error', e => void Logger.log("Global error:", e.error?.stack || e.message));
        window.addEventListener('unhandledrejection', e => void Logger.log("Unhandled rejection:", e.reason?.stack || e.reason));

        await this.loadSettings();

        // CRITICAL CONSTRAINT: Synchronous Tab registration before any awaits
        this.dataService = new DataService(this.app);
        this.addSettingTab(new FluentOneNoteSettingTab(this.app, this));

        // Register the single View
        this.registerView(VIEW_TYPE_SECTIONS, (leaf) => new OneNoteViewWrapper(leaf, this.dataService, this));

        // Ribbon icon: Opens the popup Modal
        this.addRibbonIcon("layers", "Open Fluent OneNote", () => {
            new OneNoteModal(this.app, this, this.dataService).open();
        });

        // Commands
        this.addCommand({
            id: "open-onenote-popup",
            name: "Open navigation popup",
            callback: () => {
                new OneNoteModal(this.app, this, this.dataService).open();
            },
        });

        this.addCommand({
            id: "open-onenote-sidebar",
            name: "Open navigation sidebar",
            callback: () => {
                void this.activateView();
            },
        });

        this.addCommand({
            id: "open-recent-pages",
            name: "Open recent pages list",
            callback: () => {
                new RecentPagesModal(this.app, this).open();
            }
        });

        this.app.workspace.onLayoutReady(async () => {
            await this.loadSettings();
            this.applySettings();
            this.applyDisplayMode();

            void Logger.log("Fluent OneNote plugin loaded successfully.");
        });
    }

    onunload(): void {
        void Logger.log("Fluent OneNote plugin unloaded.");
    }

    // =============================================
    // Settings Management
    // =============================================

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if ((this.settings.displayMode as unknown as string) === "sidebar") {
            this.settings.displayMode = "both";
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // Sync active view
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SECTIONS);
        for (const leaf of leaves) {
            if (leaf.view instanceof OneNoteViewWrapper) {
                leaf.view.updateRootFolder(this.settings.rootFolder);
            }
        }
    }

    applySettings() {
        document.body.setCssProps({
            "--on-accent": this.settings.accentColor,
            "--on-accent-glow": `${this.settings.accentColor}99`,
            "--on-accent-light": `${this.settings.accentColor}26`,
            "--on-modal-width": `${this.settings.modalWidth ?? 65}vw`,
            "--on-modal-height": `${this.settings.modalHeight ?? 70}vh`,
        });
    }

    applyDisplayMode() {
        const mode = this.settings.displayMode;
        if (mode === "both") {
            if (this.app.workspace.getLeavesOfType(VIEW_TYPE_SECTIONS).length === 0) {
                void this.activateView();
            }
        } else {
            // mode === "floating": detach sidebar leaf if loaded
            this.app.workspace.getLeavesOfType(VIEW_TYPE_SECTIONS).forEach(leaf => {
                leaf.detach();
            });
        }
    }

    // =============================================
    // Recent Pages Tracker
    // =============================================

    recordRecentPage(filepath: string) {
        if (!this.settings.recentPages) {
            this.settings.recentPages = [];
        }
        // Deduplicate and insert at head
        const recent = this.settings.recentPages.filter(r => r.filepath !== filepath);
        recent.unshift({ filepath, timestamp: Date.now() });
        this.settings.recentPages = recent.slice(0, MAX_RECENT_PAGES); // Keep max recent pages
        void this.saveSettings();
    }

    // =============================================
    // View Activation
    // =============================================

    async activateView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(VIEW_TYPE_SECTIONS)[0] ?? null;

        if (!leaf) {
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_SECTIONS, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }

        return leaf;
    }
}
