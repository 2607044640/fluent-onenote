import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type FluentOneNotePlugin from "./main";
import { DisplayMode, RecentPageItem } from "./types";

export interface FluentOneNoteSettings {
    rootFolder: string;
    accentColor: string;
    displayMode: DisplayMode;
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
}
