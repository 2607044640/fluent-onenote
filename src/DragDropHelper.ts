import { App, TFile, TFolder } from "obsidian";
import { PageInfo, SectionInfo } from "./types";
import { PathUtils } from "./utils/PathUtils";

export const DND_MIME_TYPE = "application/x-a1onenote-drag";

export interface DragData {
    type: "section" | "page";
    path: string; // folderPath or filepath
    page?: PageInfo;
    section?: SectionInfo;
}

let activeDragData: DragData | null = null;

export class DragDropHelper {
    public static setDragData(data: DragData | null) {
        activeDragData = data;
    }

    public static getDragData(): DragData | null {
        return activeDragData;
    }

    /**
     * Reorder Notebook within root list and save to customNotebookOrder settings
     */
    public static async reorderNotebook(
        pluginSettings: any, 
        saveSettings: () => Promise<void>, 
        sourceNotebookPath: string, 
        targetNotebookPath: string, 
        position: "top" | "bottom", 
        allNotebooks: any[]
    ): Promise<void> {
        console.log(`[A1OneNote DnD] reorderNotebook: source = ${sourceNotebookPath}, target = ${targetNotebookPath}, pos = ${position}`);
        if (!sourceNotebookPath || !targetNotebookPath || PathUtils.isEqual(sourceNotebookPath, targetNotebookPath)) {
            return;
        }

        const normSource = PathUtils.normalize(sourceNotebookPath);
        const normTarget = PathUtils.normalize(targetNotebookPath);

        const currentPaths = allNotebooks.map(nb => PathUtils.normalize(nb.folderPath));
        if (!currentPaths.includes(normSource) || !currentPaths.includes(normTarget)) {
            return;
        }

        const filtered = currentPaths.filter(p => p !== normSource);
        const targetIndex = filtered.indexOf(normTarget);
        if (targetIndex === -1) return;

        const insertIndex = position === "top" ? targetIndex : targetIndex + 1;
        filtered.splice(insertIndex, 0, normSource);

        pluginSettings.customNotebookOrder = filtered;
        await saveSettings();
    }

    /**
     * Move a Page file or Folder to a target Section or Notebook folder
     */
    public static async movePageToSection(app: App, page: PageInfo, targetSectionFolderPath: string): Promise<void> {
        console.log(`[A1OneNote DnD] movePageToSection START: page = ${page.filepath}, targetSection = ${targetSectionFolderPath}`);
        
        let abstractFile = app.vault.getAbstractFileByPath(page.filepath);
        if (!abstractFile && page.folderPath) {
            abstractFile = app.vault.getAbstractFileByPath(page.folderPath);
        }

        if (!abstractFile) {
            console.warn(`[A1OneNote DnD] movePageToSection ABORT: file/folder not found: ${page.filepath}`);
            return;
        }

        const targetFolder = app.vault.getAbstractFileByPath(targetSectionFolderPath);
        if (!targetFolder || !(targetFolder instanceof TFolder)) {
            console.warn(`[A1OneNote DnD] movePageToSection ABORT: target folder not found: ${targetSectionFolderPath}`);
            return;
        }

        // Don't move if already in target folder
        if (abstractFile.parent && PathUtils.isEqual(abstractFile.parent.path, targetFolder.path)) {
            console.log(`[A1OneNote DnD] movePageToSection SKIP: file already in target folder ${targetFolder.path}`);
            return;
        }

        const newPath = targetFolder.path === "/" || !targetFolder.path
            ? abstractFile.name
            : `${targetFolder.path}/${abstractFile.name}`;

        let destPath = newPath;
        let counter = 1;
        while (app.vault.getAbstractFileByPath(destPath)) {
            if (abstractFile instanceof TFile) {
                destPath = targetFolder.path === "/" || !targetFolder.path
                    ? `${abstractFile.basename} ${counter}.${abstractFile.extension}`
                    : `${targetFolder.path}/${abstractFile.basename} ${counter}.${abstractFile.extension}`;
            } else {
                destPath = targetFolder.path === "/" || !targetFolder.path
                    ? `${abstractFile.name} ${counter}`
                    : `${targetFolder.path}/${abstractFile.name} ${counter}`;
            }
            counter++;
        }

        console.log(`[A1OneNote DnD] movePageToSection RENAMING ${abstractFile.path} -> ${destPath}`);
        await app.fileManager.renameFile(abstractFile, destPath);
    }

    /**
     * Reorder Page within a Section list and save to customPageOrder settings.
     * Supports multi-level nested page (sub-page) reordering.
     */
    public static async reorderPage(
        pluginSettings: any, 
        saveSettings: () => Promise<void>, 
        sourcePagePath: string, 
        targetPagePath: string, 
        position: "top" | "bottom", 
        currentPages: PageInfo[], 
        sectionFolderPath: string
    ): Promise<void> {
        console.log(`[A1OneNote DnD] reorderPage START: source = ${sourcePagePath}, target = ${targetPagePath}, pos = ${position}, sectionFolder = ${sectionFolderPath}`);
        if (!sourcePagePath || !targetPagePath || PathUtils.isEqual(sourcePagePath, targetPagePath)) {
            console.warn(`[A1OneNote DnD] reorderPage ABORT: identical or missing paths`);
            return;
        }

        const normSource = PathUtils.normalize(sourcePagePath);
        const normTarget = PathUtils.normalize(targetPagePath);
        const normSection = PathUtils.normalize(sectionFolderPath);

        // Recursive helper to locate sibling list containing target page
        function findPageSiblingsAndParent(list: PageInfo[], tPath: string): { siblings: PageInfo[], parentKey: string } | null {
            if (list.some(p => PathUtils.isEqual(p.filepath, tPath))) {
                return { siblings: list, parentKey: normSection };
            }
            for (const p of list) {
                if (p.children && p.children.length > 0) {
                    if (p.children.some(child => PathUtils.isEqual(child.filepath, tPath))) {
                        return { siblings: p.children, parentKey: PathUtils.normalize(p.filepath) };
                    }
                    const res = findPageSiblingsAndParent(p.children, tPath);
                    if (res) return res;
                }
            }
            return null;
        }

        const match = findPageSiblingsAndParent(currentPages, normTarget);
        const siblings = match ? match.siblings : currentPages;
        const targetParentKey = match ? match.parentKey : normSection;

        const currentPaths = siblings.map(p => PathUtils.normalize(p.filepath));
        if (!currentPaths.includes(normSource)) currentPaths.push(normSource);
        if (!currentPaths.includes(normTarget)) currentPaths.push(normTarget);

        const filtered = currentPaths.filter(p => p !== normSource);
        const targetIndex = filtered.indexOf(normTarget);
        if (targetIndex === -1) {
            console.warn(`[A1OneNote DnD] reorderPage ABORT: targetIndex is -1`);
            return;
        }

        const insertIndex = position === "top" ? targetIndex : targetIndex + 1;
        filtered.splice(insertIndex, 0, normSource);

        if (!pluginSettings.customPageOrder) {
            pluginSettings.customPageOrder = {};
        }
        pluginSettings.customPageOrder[targetParentKey] = filtered;
        console.log(`[A1OneNote DnD] reorderPage SAVED customPageOrder[${targetParentKey}] =`, filtered);
        await saveSettings();
    }

    /**
     * Reorder Section within list and save to customSectionOrder settings
     */
    public static async reorderSection(
        pluginSettings: any, 
        saveSettings: () => Promise<void>, 
        sourceFolderPath: string, 
        targetFolderPath: string, 
        position: "top" | "bottom", 
        allSections: SectionInfo[],
        notebookFolderPath: string
    ): Promise<void> {
        console.log(`[A1OneNote DnD] reorderSection START: source = ${sourceFolderPath}, target = ${targetFolderPath}, pos = ${position}, notebook = ${notebookFolderPath}`);
        if (!sourceFolderPath || !targetFolderPath || PathUtils.isEqual(sourceFolderPath, targetFolderPath)) {
            return;
        }

        const normSource = PathUtils.normalize(sourceFolderPath);
        const normTarget = PathUtils.normalize(targetFolderPath);
        const normNotebook = PathUtils.normalize(notebookFolderPath);

        const currentPaths = allSections.map(s => PathUtils.normalize(s.folderPath));
        if (!currentPaths.includes(normSource) || !currentPaths.includes(normTarget)) {
            console.warn(`[A1OneNote DnD] reorderSection ABORT: source or target not in sections list`);
            return;
        }

        const filtered = currentPaths.filter(p => p !== normSource);
        const targetIndex = filtered.indexOf(normTarget);
        if (targetIndex === -1) return;

        const insertIndex = position === "top" ? targetIndex : targetIndex + 1;
        filtered.splice(insertIndex, 0, normSource);

        if (!pluginSettings.customSectionOrderMap) {
            pluginSettings.customSectionOrderMap = {};
        }

        if (normNotebook) {
            pluginSettings.customSectionOrderMap[normNotebook] = filtered;
            console.log(`[A1OneNote DnD] reorderSection SAVED customSectionOrderMap[${normNotebook}] =`, filtered);
        } else {
            pluginSettings.customSectionOrder = filtered;
            console.log(`[A1OneNote DnD] reorderSection SAVED customSectionOrder =`, filtered);
        }

        await saveSettings();
    }
}
