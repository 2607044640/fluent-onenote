import { App, Menu, Notice, TFile, TFolder } from "obsidian";
import { type SectionInfo, type PageInfo, type NotebookInfo } from "./types";
import { DEFAULT_UNTITLED_NOTE_NAME, DEFAULT_NEW_SECTION_NAME, DEFAULT_NEW_NOTEBOOK_NAME } from "./constants";

export class ContextMenuHelper {

    /**
     * Show right-click context menu for a Notebook (folder)
     */
    static showNotebookContextMenu(
        e: MouseEvent,
        app: App,
        nb: NotebookInfo,
        onRefresh: () => void,
        onRename?: () => void
    ) {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 1. Rename Notebook
        menu.addItem((item) => {
            item.setTitle("Rename notebook")
                .setIcon("edit-3")
                .onClick(() => {
                    if (onRename) onRename();
                });
        });

        // 2. New Section inside Notebook
        menu.addItem((item) => {
            item.setTitle("New section")
                .setIcon("folder-plus")
                .onClick(async () => {
                    const newSec = await ContextMenuHelper.createNewSectionInsideNotebook(app, nb.folderPath);
                    if (newSec) {
                        new Notice(`Created section "${newSec.name}" in "${nb.name}"`);
                    }
                    onRefresh();
                });
        });

        menu.addSeparator();

        // 3. Copy Notebook Path
        menu.addItem((item) => {
            item.setTitle("Copy notebook path")
                .setIcon("link")
                .onClick(() => {
                    void navigator.clipboard.writeText(nb.folderPath);
                    new Notice("Copied notebook path to clipboard");
                });
        });

        // 4. Show in System Explorer
        menu.addItem((item) => {
            item.setTitle("Show in system explorer")
                .setIcon("folder-open")
                .onClick(() => {
                    const abstractFile = app.vault.getAbstractFileByPath(nb.folderPath);
                    if (abstractFile) {
                        (app as unknown as { showInFolder: (path: string) => void }).showInFolder(abstractFile.path);
                    }
                });
        });

        // 5. Delete Notebook (move folder & contents safely to system trash)
        menu.addItem((item) => {
            item.setTitle("Delete notebook")
                .setIcon("trash")
                .onClick(async () => {
                    const abstractFile = app.vault.getAbstractFileByPath(nb.folderPath);
                    if (abstractFile && abstractFile instanceof TFolder) {
                        await app.fileManager.trashFile(abstractFile);
                        new Notice(`Moved notebook "${nb.name}" to trash`);
                        onRefresh();
                    }
                });
        });

        menu.showAtMouseEvent(e);
    }

    /**
     * Show right-click context menu for a Section (folder)
     */
    static showSectionContextMenu(
        e: MouseEvent, 
        app: App, 
        sec: SectionInfo,
        onRefresh: () => void,
        onRename?: () => void
    ) {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 1. Rename Section
        menu.addItem((item) => {
            item.setTitle("Rename section")
                .setIcon("edit-3")
                .onClick(() => {
                    if (onRename) onRename();
                });
        });

        // 2. New Page inside Section
        menu.addItem((item) => {
            item.setTitle("New page")
                .setIcon("file-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewPage(app, sec.folderPath);
                    onRefresh();
                });
        });

        // 3. New Section (Sub-section)
        menu.addItem((item) => {
            item.setTitle("New section")
                .setIcon("folder-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewSection(app, sec.folderPath);
                    onRefresh();
                });
        });

        menu.addSeparator();

        // 4. Copy Section Path
        menu.addItem((item) => {
            item.setTitle("Copy section path")
                .setIcon("link")
                .onClick(() => {
                    void navigator.clipboard.writeText(sec.folderPath);
                    new Notice("Copied section path to clipboard");
                });
        });

        // 5. Show in System Explorer
        menu.addItem((item) => {
            item.setTitle("Show in system explorer")
                .setIcon("folder-open")
                .onClick(() => {
                    const abstractFile = app.vault.getAbstractFileByPath(sec.folderPath);
                    if (abstractFile) {
                        (app as unknown as { showInFolder: (path: string) => void }).showInFolder(abstractFile.path);
                    }
                });
        });

        // 6. Delete Section (move folder & contents safely to system trash)
        menu.addItem((item) => {
            item.setTitle("Delete section")
                .setIcon("trash")
                .onClick(async () => {
                    const abstractFile = app.vault.getAbstractFileByPath(sec.folderPath);
                    if (abstractFile && abstractFile instanceof TFolder) {
                        await app.fileManager.trashFile(abstractFile);
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
        onRefresh: () => void,
        onRename?: () => void
    ) {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 1. Rename Note
        menu.addItem((item) => {
            item.setTitle("Rename note")
                .setIcon("edit-3")
                .onClick(() => {
                    if (onRename) onRename();
                });
        });

        // 2. New Sub Page (Create child note under this page)
        menu.addItem((item) => {
            item.setTitle("New sub page")
                .setIcon("file-plus")
                .onClick(async () => {
                    await ContextMenuHelper.createNewSubPage(app, page);
                    onRefresh();
                });
        });

        // 3. New Page in same Section
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

        // 4. Copy Obsidian Link [[Page Name]]
        menu.addItem((item) => {
            item.setTitle("Copy Obsidian link")
                .setIcon("link")
                .onClick(() => {
                    const wikiLink = `[[${page.name}]]`;
                    void navigator.clipboard.writeText(wikiLink);
                    new Notice(`Copied ${wikiLink} to clipboard`);
                });
        });

        menu.addSeparator();

        // 5. Show in System Explorer
        menu.addItem((item) => {
            item.setTitle("Show in system explorer")
                .setIcon("folder-open")
                .onClick(() => {
                    const abstractFile = app.vault.getAbstractFileByPath(page.filepath);
                    if (abstractFile) {
                        (app as unknown as { showInFolder: (path: string) => void }).showInFolder(abstractFile.path);
                    }
                });
        });

        // 6. Delete Page options
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

    /** Helper: Rename a Notebook folder */
    public static async renameNotebook(app: App, nb: NotebookInfo, newName: string): Promise<boolean> {
        const cleanName = newName.trim();
        if (!cleanName) {
            new Notice("Notebook name cannot be empty");
            return false;
        }
        if (cleanName === nb.name) {
            return false;
        }
        if (/[\\/:*?"<>|]/.test(cleanName)) {
            new Notice('Notebook name contains invalid characters (/ \\ : * ? " < > |)');
            return false;
        }

        const folder = app.vault.getAbstractFileByPath(nb.folderPath);
        if (!folder || !(folder instanceof TFolder)) {
            new Notice("Notebook folder not found");
            return false;
        }

        const parentDir = folder.parent ? folder.parent.path : "";
        const newPath = (!parentDir || parentDir === "/") ? cleanName : `${parentDir}/${cleanName}`;

        if (app.vault.getAbstractFileByPath(newPath)) {
            new Notice(`A notebook with name "${cleanName}" already exists`);
            return false;
        }

        try {
            await app.fileManager.renameFile(folder, newPath);
            new Notice(`Renamed notebook to "${cleanName}"`);
            return true;
        } catch (err: any) {
            console.error("Failed to rename notebook:", err);
            new Notice(`Failed to rename notebook: ${err?.message || err}`);
            return false;
        }
    }

    /** Helper: Rename a Section folder */
    public static async renameSection(app: App, sec: SectionInfo, newName: string): Promise<boolean> {
        const cleanName = newName.trim();
        if (!cleanName) {
            new Notice("Section name cannot be empty");
            return false;
        }
        if (cleanName === sec.name) {
            return false;
        }
        if (/[\\/:*?"<>|]/.test(cleanName)) {
            new Notice('Section name contains invalid characters (/ \\ : * ? " < > |)');
            return false;
        }

        const folder = app.vault.getAbstractFileByPath(sec.folderPath);
        if (!folder || !(folder instanceof TFolder)) {
            new Notice("Section folder not found");
            return false;
        }

        const parentDir = folder.parent ? folder.parent.path : "";
        const newPath = (!parentDir || parentDir === "/") ? cleanName : `${parentDir}/${cleanName}`;

        if (app.vault.getAbstractFileByPath(newPath)) {
            new Notice(`A section with name "${cleanName}" already exists`);
            return false;
        }

        try {
            await app.fileManager.renameFile(folder, newPath);
            new Notice(`Renamed section to "${cleanName}"`);
            return true;
        } catch (err: any) {
            console.error("Failed to rename section:", err);
            new Notice(`Failed to rename section: ${err?.message || err}`);
            return false;
        }
    }

    /** Helper: Rename a Note file (and its companion folder if Folder-Note) */
    public static async renamePage(app: App, page: PageInfo, newName: string): Promise<boolean> {
        const cleanName = newName.replace(/\.md$/i, "").trim();
        if (!cleanName) {
            new Notice("Note name cannot be empty");
            return false;
        }
        if (cleanName === page.name) {
            return false;
        }
        if (/[\\/:*?"<>|]/.test(cleanName)) {
            new Notice('Note name contains invalid characters (/ \\ : * ? " < > |)');
            return false;
        }

        const file = app.vault.getAbstractFileByPath(page.filepath);
        if (!file || !(file instanceof TFile)) {
            new Notice("Note file not found");
            return false;
        }

        const parentDir = file.parent ? file.parent.path : "";
        const newFilePath = (!parentDir || parentDir === "/") ? `${cleanName}.md` : `${parentDir}/${cleanName}.md`;

        if (app.vault.getAbstractFileByPath(newFilePath)) {
            new Notice(`A note with name "${cleanName}" already exists`);
            return false;
        }

        // Check if this note is a Folder-Note (has companion folder)
        const companionFolderPath = (!parentDir || parentDir === "/") ? page.name : `${parentDir}/${page.name}`;
        const companionFolder = app.vault.getAbstractFileByPath(companionFolderPath);
        const hasCompanionFolder = companionFolder && companionFolder instanceof TFolder;

        try {
            // 1. Rename the markdown note file
            await app.fileManager.renameFile(file, newFilePath);

            // 2. If companion folder exists, rename the companion folder as well to maintain Folder-Note fusion!
            if (hasCompanionFolder) {
                const newFolderPath = (!parentDir || parentDir === "/") ? cleanName : `${parentDir}/${cleanName}`;
                if (!app.vault.getAbstractFileByPath(newFolderPath)) {
                    await app.fileManager.renameFile(companionFolder, newFolderPath);
                }
            }

            new Notice(`Renamed note to "${cleanName}"`);
            return true;
        } catch (err: any) {
            console.error("Failed to rename note:", err);
            new Notice(`Failed to rename note: ${err?.message || err}`);
            return false;
        }
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

    /** Helper: Create a new notebook folder directly inside rootFolder */
    public static async createNewNotebook(app: App, rootFolder: string): Promise<TFolder | null> {
        const cleanRoot = (rootFolder || "").trim().replace(/^\/+|\/+$/g, "");
        
        let baseName = DEFAULT_NEW_NOTEBOOK_NAME;
        let targetPath = cleanRoot ? `${cleanRoot}/${baseName}` : baseName;
        let counter = 1;

        while (app.vault.getAbstractFileByPath(targetPath)) {
            targetPath = cleanRoot ? `${cleanRoot}/${baseName} ${counter}` : `${baseName} ${counter}`;
            counter++;
        }

        // Ensure root folder exists if cleanRoot is specified
        if (cleanRoot) {
            const rootFile = app.vault.getAbstractFileByPath(cleanRoot);
            if (!rootFile) {
                await app.vault.createFolder(cleanRoot);
            }
        }

        const newFolder = await app.vault.createFolder(targetPath);
        return newFolder instanceof TFolder ? newFolder : null;
    }

    /** Helper: Create a new section directly inside a notebook folder */
    public static async createNewSectionInsideNotebook(app: App, notebookFolderPath: string): Promise<TFolder | null> {
        const cleanParent = (notebookFolderPath || "").trim().replace(/^\/+|\/+$/g, "");
        let baseName = DEFAULT_NEW_SECTION_NAME;
        let targetPath = cleanParent ? `${cleanParent}/${baseName}` : baseName;
        let counter = 1;

        while (app.vault.getAbstractFileByPath(targetPath)) {
            targetPath = cleanParent ? `${cleanParent}/${baseName} ${counter}` : `${baseName} ${counter}`;
            counter++;
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
                await app.fileManager.trashFile(file);

                // 3. Remove empty folder if empty
                if (folder.children.length === 0) {
                    await app.vault.adapter.rmdir(folder.path, true);
                }
                return;
            }
        }

        // Standard single file delete
        await app.fileManager.trashFile(file);
    }

    /**
     * Delete a page and all its child sub-pages by moving the folder to trash.
     */
    public static async deletePageAndAllSubPages(app: App, page: PageInfo): Promise<void> {
        if (page.folderPath) {
            const folder = app.vault.getAbstractFileByPath(page.folderPath);
            if (folder && folder instanceof TFolder) {
                await app.fileManager.trashFile(folder);
                return;
            }
        }
        await ContextMenuHelper.deletePageSafely(app, page);
    }
}
