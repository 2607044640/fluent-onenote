import { FuzzySuggestModal, App } from "obsidian";
import type FluentOneNotePlugin from "./main";
import { RecentPageItem } from "./types";

export class RecentPagesModal extends FuzzySuggestModal<RecentPageItem> {
    private plugin: FluentOneNotePlugin;

    constructor(app: App, plugin: FluentOneNotePlugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("Search recent pages...");
        
        // Remove the default Obsidian popup sizing restrictions so it looks comfortable
        this.modalEl.addClass("on-recent-modal");
    }

    getItems(): RecentPageItem[] {
        // Return sorted items (newest first)
        return [...this.plugin.settings.recentPages].sort((a, b) => b.timestamp - a.timestamp);
    }

    getItemText(item: RecentPageItem): string {
        // Display the note's name (filename without path and extension)
        const name = item.filepath.split("/").pop()?.replace(/\.md$/, "") ?? item.filepath;
        
        // Include the parent section path in brackets for context if it exists
        const parts = item.filepath.split("/");
        if (parts.length > 2) {
            const sectionName = parts[parts.length - 2];
            return `${name} [in ${sectionName}]`;
        }
        return name;
    }

    onChooseItem(item: RecentPageItem): void {
        this.app.workspace.openLinkText(item.filepath, "", false);
        
        // Refresh timestamp upon choosing
        this.plugin.recordRecentPage(item.filepath);
    }
}
