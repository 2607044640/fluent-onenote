import { App, Menu, Notice, TFile, TFolder } from "obsidian";
import { type SectionInfo, type PageInfo } from "./types";
import { DEFAULT_UNTITLED_NOTE_NAME, DEFAULT_NEW_SECTION_NAME } from "./constants";

export class ContextMenuHelper {

    /**
     * Show right-click context menu for a Section (folder)
     */
    static showSectionContextMenu(
        e: MouseEvent, 
        app: App, 
        sec: SectionInfo,
        onRefresh: () => void
    ) {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 1. New Page inside Section
        menu.addItem((item) => {
            item.setTitle("New page")
                .setIcon("file-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewPage(app, sec.folderPath);
                    onRefresh();
                });
        });

        // 2. New Section (Sub-section)
        menu.addItem((item) => {
            item.setTitle("New section")
                .setIcon("folder-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewSection(app, sec.folderPath);
                    onRefresh();
                });
        });

        menu.addSeparator();

        // 3. Copy Section Path
        menu.addItem((item) => {
            item.setTitle("Copy section path")
                .setIcon("link")
                .onClick(() => {
                    navigator.clipboard.writeText(sec.folderPath);
                    new Notice("Copied section path to clipboard");
                });
        });

        // 4. Show in System Explorer
        menu.addItem((item) => {
            item.setTitle("Show in system explorer")
                .setIcon("folder-open")
                .onClick(() => {
                    const abstractFile = app.vault.getAbstractFileByPath(sec.folderPath);
                    if (abstractFile) {
                        (app as any).showInFolder(abstractFile.path);
                    }
                });
        });

        // 5. Delete Section (move folder & contents safely to system trash)
        menu.addItem((item) => {
            item.setTitle("Delete section")
                .setIcon("trash")
                .onClick(async () => {
                    const abstractFile = app.vault.getAbstractFileByPath(sec.folderPath);
                    if (abstractFile && abstractFile instanceof TFolder) {
                        await app.vault.trash(abstractFile, true);
                        new Notice(`Moved section "${sec.name}" to trash`);
                        onRefresh();
                    }
                });
        });

        menu.showAtMouseEvent(e);
    }

    /**
     * Show right-click context menu for a Page (note file)
     */
    static showPageContextMenu(
        e: MouseEvent, 
        app: App, 
        page: PageInfo,
        secFolderPath: string,
        onRefresh: () => void
    ) {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 1. New Sub Page (Create child note under this page)
        menu.addItem((item) => {
            item.setTitle("New sub page")
                .setIcon("file-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewSubPage(app, page);
                    onRefresh();
                });
        });

        // 2. New Page in same Section
        if (secFolderPath) {
            menu.addItem((item) => {
                item.setTitle("New page in section")
                    .setIcon("file-plus")
                    .onClick(async () => {
                        await ContextMenuHelper.createNewPage(app, secFolderPath);
                        onRefresh();
                    });
            });
        }

        // 3. Copy Obsidian Link [[Page Name]]
        menu.addItem((item) => {
            item.setTitle("Copy Obsidian link")
                .setIcon("link")
                .onClick(() => {
                    const wikiLink = `[[${page.name}]]`;
                    navigator.clipboard.writeText(wikiLink);
                    new Notice(`Copied ${wikiLink} to clipboard`);
                });
        });

        menu.addSeparator();

        // 4. Show in System Explorer
        menu.addItem((item) => {
            item.setTitle("Show in system explorer")
                .setIcon("folder-open")
                .onClick(() => {
                    const abstractFile = app.vault.getAbstractFileByPath(page.filepath);
                    if (abstractFile) {
                        (app as any).showInFolder(abstractFile.path);
                    }
                });
        });

        // 5. Delete Page options
        const hasSubPages = (page.children && page.children.length > 0) || !!page.folderPath;
        if (hasSubPages) {
            menu.addItem((item) => {
                item.setTitle("Delete note (Keep sub-pages)")
                    .setIcon("trash")
                    .onClick(async () => {
                        await ContextMenuHelper.deletePageSafely(app, page);
                        onRefresh();
                    });
            });
            menu.addItem((item) => {
                item.setTitle("Delete note & all sub-pages")
                    .setIcon("trash-2")
                    .onClick(async () => {
                        await ContextMenuHelper.deletePageAndAllSubPages(app, page);
                        onRefresh();
                    });
            });
        } else {
            menu.addItem((item) => {
                item.setTitle("Delete note")
                    .setIcon("trash")
                    .onClick(async () => {
                        await ContextMenuHelper.deletePageSafely(app, page);
                        onRefresh();
                    });
            });
        }

        menu.showAtMouseEvent(e);
    }

    /** Helper: Create a new sub-page note under an existing page */
    public static async createNewSubPage(app: App, page: PageInfo): Promise<TFile | null> {
        let targetFolderPath = page.folderPath;

        // If page is not yet a Folder-Note, convert it by creating a same-name folder and moving the file inside
        if (!targetFolderPath) {
            const file = app.vault.getAbstractFileByPath(page.filepath);
            if (!(file instanceof TFile)) return null;

            const parentFolderPath = file.parent ? file.parent.path : "";
            const folderName = page.name;
            const newFolderPath = !parentFolderPath || parentFolderPath === "/" 
                ? folderName 
                : `${parentFolderPath}/${folderName}`;

            // Create target folder if it doesn't exist
            let targetFolder = app.vault.getAbstractFileByPath(newFolderPath);
            if (!targetFolder) {
                targetFolder = await app.vault.createFolder(newFolderPath);
            }

            // Move main note file into the new folder as parent Folder-Note
            const newMainNotePath = `${newFolderPath}/${file.name}`;
            if (file.path !== newMainNotePath) {
                await app.fileManager.renameFile(file, newMainNotePath);
            }

            targetFolderPath = newFolderPath;
        }

        // Now create a new sub-page note inside targetFolderPath
        return await ContextMenuHelper.createNewPage(app, targetFolderPath);
    }

    /** Helper: Create a new markdown page in specified folder path */
    public static async createNewPage(app: App, sectionFolderPath: string): Promise<TFile | null> {
        let baseName = DEFAULT_UNTITLED_NOTE_NAME;
        let folderPath = sectionFolderPath;

        if (!folderPath) {
            folderPath = "";
        }

        let targetPath = folderPath 
            ? `${folderPath}/${baseName}.md`
            : `${baseName}.md`;

        let counter = 1;
        while (app.vault.getAbstractFileByPath(targetPath)) {
            targetPath = folderPath
                ? `${folderPath}/${baseName} ${counter}.md`
                : `${baseName} ${counter}.md`;
            counter++;
        }

        // Ensure parent directory exists
        const folder = app.vault.getAbstractFileByPath(folderPath);
        if (!folder && folderPath) {
            await app.vault.createFolder(folderPath);
        }

        const newFile = await app.vault.create(targetPath, "");
        return newFile;
    }

    /** Helper: Create a new sibling section in the parent directory of specified section */
    public static async createNewSection(app: App, currentSectionPath: string): Promise<TFolder | null> {
        const folder = app.vault.getAbstractFileByPath(currentSectionPath);
        let targetPath = "";
        if (folder) {
            const parentDir = folder.parent ? folder.parent.path : "";
            const parentPath = (!parentDir || parentDir === "/") ? "" : parentDir;

            let baseName = DEFAULT_NEW_SECTION_NAME;
            targetPath = parentPath ? `${parentPath}/${baseName}` : baseName;
            let counter = 1;

            while (app.vault.getAbstractFileByPath(targetPath)) {
                targetPath = parentPath ? `${parentPath}/${baseName} ${counter}` : `${baseName} ${counter}`;
                counter++;
            }
        } else {
            let baseName = DEFAULT_NEW_SECTION_NAME;
            targetPath = currentSectionPath ? `${currentSectionPath}/${baseName}` : baseName;
            let counter = 1;

            while (app.vault.getAbstractFileByPath(targetPath)) {
                targetPath = currentSectionPath ? `${currentSectionPath}/${baseName} ${counter}` : `${baseName} ${counter}`;
                counter++;
            }
        }

        const newFolder = await app.vault.createFolder(targetPath);
        return newFolder instanceof TFolder ? newFolder : null;
    }

    /**
     * Delete a page safely. If it is a Folder-Note with sub-pages:
     * 1. Safely promote all child sub-pages up to the parent section folder.
     * 2. Move main note file to system trash.
     * 3. Remove empty folder directory.
     */
    public static async deletePageSafely(app: App, page: PageInfo): Promise<void> {
        const file = app.vault.getAbstractFileByPath(page.filepath);
        if (!file || !(file instanceof TFile)) return;

        // If page has a folderPath (Folder-Note)
        if (page.folderPath) {
            const folder = app.vault.getAbstractFileByPath(page.folderPath);
            if (folder && folder instanceof TFolder) {
                const parentSectionFolder = folder.parent;
                const targetParentPath = parentSectionFolder ? parentSectionFolder.path : "";

                // 1. Promote all child notes to targetParentPath
                for (const child of [...folder.children]) {
                    if (child instanceof TFile && child.path !== file.path) {
                        const newChildPath = (!targetParentPath || targetParentPath === "/")
                            ? child.name
                            : `${targetParentPath}/${child.name}`;
                        
                        let destPath = newChildPath;
                        let counter = 1;
                        while (app.vault.getAbstractFileByPath(destPath)) {
                            destPath = (!targetParentPath || targetParentPath === "/")
                                ? `${child.basename} ${counter}.${child.extension}`
                                : `${targetParentPath}/${child.basename} ${counter}.${child.extension}`;
                            counter++;
                        }
                        await app.fileManager.renameFile(child, destPath);
                    }
                }

                // 2. Move main note file to system trash
                await app.vault.trash(file, true);

                // 3. Remove empty folder if empty
                if (folder.children.length === 0) {
                    await app.vault.adapter.rmdir(folder.path, true);
                }
                return;
            }
        }

        // Standard single file delete
        await app.vault.trash(file, true);
    }

    /**
     * Delete a page and all its child sub-pages by moving the folder to trash.
     */
    public static async deletePageAndAllSubPages(app: App, page: PageInfo): Promise<void> {
        if (page.folderPath) {
            const folder = app.vault.getAbstractFileByPath(page.folderPath);
            if (folder && folder instanceof TFolder) {
                await app.vault.trash(folder, true);
                return;
            }
        }
        await ContextMenuHelper.deletePageSafely(app, page);
    }
}
