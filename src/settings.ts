import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import type FluentOneNotePlugin from "./main";
import { DisplayMode, RecentPageItem, EventName } from "./types";
import { EventBus } from "./EventBus";

export interface FluentOneNoteSettings {
    rootFolder: string;
    accentColor: string;
    displayMode: DisplayMode;
    hideRibbonIcon: boolean;
    tipShownCount: number;
    expandedPaths: string[];
    selectedSectionPath: string;
    recentPages: RecentPageItem[];
    modalWidth: number;
    modalHeight: number;
    enableDOMVirtualization: boolean;
    customPageOrder: Record<string, string[]>;
    customSectionOrder: string[];
    customSectionOrderMap: Record<string, string[]>;
    customNotebookOrder: string[];
}

export const DEFAULT_SETTINGS: FluentOneNoteSettings = {
    rootFolder: "OneNote",
    accentColor: "#8b5cf6",
    displayMode: "both",
    hideRibbonIcon: false,
    tipShownCount: 0,
    expandedPaths: [],
    selectedSectionPath: "",
    recentPages: [],
    modalWidth: 65,
    modalHeight: 70,
    enableDOMVirtualization: false,
    customPageOrder: {},
    customSectionOrder: [],
    customSectionOrderMap: {},
    customNotebookOrder: [],
};

export class ConfirmModal extends Modal {
    private titleText: string;
    private messageText: string;
    private confirmButtonText: string;
    private onConfirm: () => Promise<void> | void;

    constructor(
        app: App,
        titleText: string,
        messageText: string,
        confirmButtonText: string,
        onConfirm: () => Promise<void> | void
    ) {
        super(app);
        this.titleText = titleText;
        this.messageText = messageText;
        this.confirmButtonText = confirmButtonText;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: this.titleText });
        contentEl.createEl("p", { 
            text: this.messageText,
            cls: "on-modal-warning-text"
        });

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        buttonContainer.setCssStyles({
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "16px"
        });

        const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const confirmBtn = buttonContainer.createEl("button", {
            text: this.confirmButtonText,
            cls: "mod-warning",
        });
        confirmBtn.addEventListener("click", () => {
            this.close();
            void this.onConfirm();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class FluentOneNoteSettingTab extends PluginSettingTab {
    plugin: FluentOneNotePlugin;

    constructor(app: App, plugin: FluentOneNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName("Folder Navigation").setHeading();

        new Setting(containerEl)
            .setName("Root Folder Path")
            .setDesc("The folder path to scan for OneNote style notebooks (e.g. 'OneNote/Original Game'). Leave empty to scan the entire vault.")
            .addText(text => text
                .setPlaceholder("e.g. OneNote/Original Game")
                .setValue(this.plugin.settings.rootFolder)
                .onChange(async (value) => {
                    this.plugin.settings.rootFolder = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Display Mode")
            .setDesc("Choose how the navigation panel is displayed.")
            .addDropdown(dropdown => dropdown
                .addOption("floating", "Floating popup only")
                .addOption("both", "Both (sidebar + floating popup)")
                .setValue(this.plugin.settings.displayMode === ("sidebar" as unknown as DisplayMode) ? "both" : this.plugin.settings.displayMode)
                .onChange(async (value) => {
                    this.plugin.settings.displayMode = value as DisplayMode;
                    await this.plugin.saveSettings();
                    this.plugin.applyDisplayMode();
                }));

        new Setting(containerEl)
            .setName("Hide Ribbon Icon")
            .setDesc("Hide the Fluent OneNote icon in the left ribbon.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideRibbonIcon ?? false)
                .onChange(async (value) => {
                    this.plugin.settings.hideRibbonIcon = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshRibbonIcon();
                }));

        new Setting(containerEl).setName("Performance Optimization").setHeading();

        new Setting(containerEl)
            .setName("DOM Virtualization for Large Vaults")
            .setDesc("Experimental: Enable only if you experience scrolling lag with 5000+ notes in a single section. Keeps default rendering clean and zero-friction for normal vaults.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDOMVirtualization ?? false)
                .onChange(async (value) => {
                    this.plugin.settings.enableDOMVirtualization = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName("Popup Modal Size").setHeading();

        new Setting(containerEl)
            .setName("Modal Width (%)")
            .setDesc("Set the width percentage of the navigation popup modal (Min: 40%, Max: 98%).")
            .addSlider(slider => slider
                .setLimits(40, 98, 1)
                .setValue(this.plugin.settings.modalWidth ?? 65)
                .onChange(async (value) => {
                    this.plugin.settings.modalWidth = value;
                    await this.plugin.saveSettings();
                    this.plugin.applySettings();
                }));

        new Setting(containerEl)
            .setName("Modal Height (%)")
            .setDesc("Set the height percentage of the navigation popup modal (Min: 40%, Max: 95%).")
            .addSlider(slider => slider
                .setLimits(40, 95, 1)
                .setValue(this.plugin.settings.modalHeight ?? 70)
                .onChange(async (value) => {
                    this.plugin.settings.modalHeight = value;
                    await this.plugin.saveSettings();
                    this.plugin.applySettings();
                }));

        const colorSetting = new Setting(containerEl)
            .setName("Accent Color")
            .setDesc("Choose the primary accent color for active elements.")
            .addColorPicker(color => color
                .setValue(this.plugin.settings.accentColor)
                .onChange(async (value) => {
                    this.plugin.settings.accentColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.applySettings();
                }));

        const nativeInput = colorSetting.controlEl.querySelector('input[type="color"]');
        if (nativeInput) {
            nativeInput.addEventListener("input", (e) => {
                const value = (e.target as HTMLInputElement).value;
                this.plugin.settings.accentColor = value;
                void (async () => {
                    await this.plugin.saveSettings();
                    this.plugin.applySettings();
                })();
            });
        }

        new Setting(containerEl).setName("Custom Order Management").setHeading();

        new Setting(containerEl)
            .setName("Export Custom Order")
            .setDesc("Export the current custom ordering of notebooks, sections, and pages to a JSON file.")
            .addButton(btn => btn
                .setButtonText("Export Order")
                .setIcon("download")
                .onClick(() => {
                    this.exportOrder();
                }));

        new Setting(containerEl)
            .setName("Import Custom Order")
            .setDesc("Import custom order configuration from a previously exported JSON file.")
            .addButton(btn => btn
                .setButtonText("Import Order")
                .setIcon("upload")
                .onClick(() => {
                    this.importOrder();
                }));

        new Setting(containerEl)
            .setName("Clear Custom Order")
            .setDesc("Clear all custom drag-and-drop orderings (notebooks, sections, and pages) and revert to default alphabetical order.")
            .addButton(btn => btn
                .setButtonText("Clear All Orders")
                .setWarning()
                .onClick(() => {
                    new ConfirmModal(
                        this.app,
                        "Clear Custom Order?",
                        "Are you sure you want to clear all custom notebook, section, and page orderings? All items will revert to default alphabetical order. This action cannot be undone.",
                        "Clear All Orders",
                        async () => {
                            this.plugin.settings.customNotebookOrder = [];
                            this.plugin.settings.customSectionOrder = [];
                            this.plugin.settings.customSectionOrderMap = {};
                            this.plugin.settings.customPageOrder = {};
                            await this.plugin.saveSettings();
                            EventBus.emit(EventName.ORDER_CHANGED);
                            new Notice("All custom orderings have been cleared.");
                        }
                    ).open();
                }));

        new Setting(containerEl).setName("Tips & Recommendations").setHeading();

        new Setting(containerEl)
            .setName("Reset Hotkey Tips Counter")
            .setDesc(`Reset the hotkey recommendation notice counter (currently shown: ${this.plugin.settings.tipShownCount}/5).`)
            .addButton(btn => btn
                .setButtonText("Reset Counter")
                .onClick(async () => {
                    this.plugin.settings.tipShownCount = 0;
                    await this.plugin.saveSettings();
                    new Notice("Hotkey tips counter has been reset to 0.");
                    this.display();
                }));
    }

    private exportOrder(): void {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            customNotebookOrder: this.plugin.settings.customNotebookOrder ?? [],
            customSectionOrder: this.plugin.settings.customSectionOrder ?? [],
            customSectionOrderMap: this.plugin.settings.customSectionOrderMap ?? {},
            customPageOrder: this.plugin.settings.customPageOrder ?? {},
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fluent-onenote-order-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        new Notice("Custom order exported successfully.");
    }

    private importOrder(): void {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.setCssStyles({ display: "none" });
        document.body.appendChild(input);

        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                if (input.parentNode) input.parentNode.removeChild(input);
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (typeof data !== "object" || data === null) {
                    throw new Error("Invalid file content: Root must be an object");
                }

                this.plugin.settings.customNotebookOrder = Array.isArray(data.customNotebookOrder)
                    ? data.customNotebookOrder
                    : [];
                this.plugin.settings.customSectionOrder = Array.isArray(data.customSectionOrder)
                    ? data.customSectionOrder
                    : [];
                this.plugin.settings.customSectionOrderMap = (typeof data.customSectionOrderMap === "object" && data.customSectionOrderMap !== null && !Array.isArray(data.customSectionOrderMap))
                    ? data.customSectionOrderMap
                    : {};
                this.plugin.settings.customPageOrder = (typeof data.customPageOrder === "object" && data.customPageOrder !== null && !Array.isArray(data.customPageOrder))
                    ? data.customPageOrder
                    : {};

                await this.plugin.saveSettings();
                EventBus.emit(EventName.ORDER_CHANGED);
                new Notice("Custom order imported successfully.");
            } catch (err) {
                console.error("[Fluent OneNote] Order import failed:", err);
                new Notice(`Failed to import order: ${err instanceof Error ? err.message : "Invalid JSON file"}`);
            } finally {
                if (input.parentNode) input.parentNode.removeChild(input);
            }
        };

        input.click();
    }
}
