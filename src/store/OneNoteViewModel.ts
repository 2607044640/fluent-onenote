import { writable, derived, get, type Writable } from "svelte/store";
import { App, Notice, TFile } from "obsidian";
import type { NotebookInfo, SectionInfo, PageInfo } from "../types";
import { DataService } from "../DataService";
import { DragDropHelper } from "../DragDropHelper";
import { PathUtils } from "../utils/PathUtils";

export class OneNoteViewModel {
    public notebooks: Writable<NotebookInfo[]> = writable([]);
    public selectedNotebook: Writable<NotebookInfo | null> = writable(null);
    public sections: Writable<SectionInfo[]> = writable([]);
    public selectedSection: Writable<SectionInfo | null> = writable(null);
    public activePagePath: Writable<string> = writable("");
    public expandedSections: Writable<Set<string>> = writable(new Set());
    public rootFolderExists: Writable<boolean> = writable(true);
    public filterQuery: Writable<string> = writable("");

    // Drag and Drop state
    public draggedItemId: Writable<string> = writable("");
    public draggedItemType: Writable<"notebook" | "section" | "page" | null> = writable(null);
    public dragOverId: Writable<string> = writable("");
    public dragPosition: Writable<"top" | "bottom" | null> = writable(null);

    // Derived stores
    public visibleSections = derived(this.sections, $sections => this.flattenVisibleSections($sections));
    
    public filteredPages = derived(
        [this.sections, this.selectedSection, this.filterQuery],
        ([$sections, $selectedSection, $filterQuery]) => {
            const trimmedQuery = $filterQuery.trim().toLowerCase();
            if (trimmedQuery) {
                const allPages = this.getAllPagesRecursive($sections);
                return allPages.filter(p => p.name.toLowerCase().includes(trimmedQuery) || p.filepath.toLowerCase().includes(trimmedQuery));
            } else {
                return $selectedSection ? $selectedSection.pages.map(p => ({ ...p, sectionName: $selectedSection?.name || "" })) : [];
            }
        }
    );

    private dragEndTimeout: any = null;

    constructor(
        public app: App,
        public plugin: any,
        public dataService: DataService,
        public rootFolder: string,
        initialExpandedPaths: string[] = [],
        initialSelectedSectionPath: string = ""
    ) {
        this.expandedSections.set(new Set(initialExpandedPaths));
        if (initialSelectedSectionPath) {
            // We will resolve it after loading notebooks
        }
    }

    public destroy() {
        if (this.dragEndTimeout) {
            clearTimeout(this.dragEndTimeout);
        }
    }

    // =============================================
    // Data Loading & Selection
    // =============================================
    public loadNotebooks(autoSelectSectionPath?: string) {
        const exists = this.checkFolderExists(this.rootFolder);
        this.rootFolderExists.set(exists);
        if (!exists) {
            this.notebooks.set([]);
            this.sections.set([]);
            this.selectedNotebook.set(null);
            this.selectedSection.set(null);
            return;
        }

        const nbs = this.dataService.getNotebooks(
            this.rootFolder,
            this.plugin?.settings?.customNotebookOrder ?? [],
            this.plugin?.settings?.customSectionOrderMap ?? {},
            this.plugin?.settings?.customPageOrder ?? {}
        );
        this.notebooks.set(nbs);

        const currentSelectedNb = get(this.selectedNotebook);

        if (nbs.length > 0) {
            let nextNb = currentSelectedNb ? nbs.find(n => n.folderPath === currentSelectedNb.folderPath) : nbs[0];
            if (!nextNb) nextNb = nbs[0];
            
            this.selectedNotebook.set(nextNb);
            this.sections.set(nextNb.sections);

            const currentSelectedSec = get(this.selectedSection);

            let targetSecPath = autoSelectSectionPath || (currentSelectedSec ? currentSelectedSec.folderPath : null);
            let targetSec = null;
            if (targetSecPath) {
                targetSec = this.findSectionByPath(nextNb.sections, targetSecPath);
            }
            if (!targetSec && nextNb.sections.length > 0) {
                targetSec = nextNb.sections[0];
            }
            this.selectedSection.set(targetSec);
        } else {
            this.selectedNotebook.set(null);
            this.sections.set([]);
            this.selectedSection.set(null);
        }
    }

    public selectNotebook(nb: NotebookInfo) {
        this.selectedNotebook.set(nb);
        this.sections.set(nb.sections);
        this.selectedSection.set(nb.sections.length > 0 ? nb.sections[0] : null);
    }

    public selectSection(sec: SectionInfo) {
        this.selectedSection.set(sec);
    }

    public toggleSection(sec: SectionInfo, onExpandedChanged?: (paths: string[]) => void) {
        this.expandedSections.update(expanded => {
            const newSet = new Set(expanded);
            if (newSet.has(sec.folderPath)) {
                newSet.delete(sec.folderPath);
            } else {
                newSet.add(sec.folderPath);
            }
            if (onExpandedChanged) {
                onExpandedChanged(Array.from(newSet));
            }
            return newSet;
        });

        this.sections.update(secs => {
            const updateRec = (items: SectionInfo[]): SectionInfo[] => {
                return items.map(item => {
                    if (item.folderPath === sec.folderPath) {
                        return { ...item, isExpanded: !item.isExpanded };
                    }
                    if (item.children && item.children.length > 0) {
                        return { ...item, children: updateRec(item.children) };
                    }
                    return item;
                });
            };
            return updateRec(secs);
        });
    }

    public autoRevealActivePage(filepath: string) {
        const currentNbs = get(this.notebooks);

        let targetNb: NotebookInfo | null = null;
        let targetSecPath: string | null = null;

        for (const nb of currentNbs) {
            const secPath = this.findSectionPathContainingPage(nb.sections, filepath);
            if (secPath) {
                targetNb = nb;
                targetSecPath = secPath;
                break;
            }
        }

        if (targetNb && targetSecPath) {
            this.selectNotebook(targetNb);
            
            // Expand all ancestors
            const ancestors = this.getSectionAncestors(targetNb.sections, targetSecPath);
            this.expandedSections.update(expanded => {
                const newSet = new Set(expanded);
                for (const a of ancestors) newSet.add(a);
                return newSet;
            });

            // Expand subpages if target is a section note
            const currentExpanded = get(this.expandedSections);
            const isTargetExpanded = currentExpanded.has(targetSecPath);

            this.sections.update(secs => {
                const updateExp = (items: SectionInfo[]): SectionInfo[] => {
                    return items.map(item => {
                        const isExpanded = currentExpanded.has(item.folderPath) || item.folderPath === targetSecPath;
                        return {
                            ...item,
                            isExpanded,
                            children: item.children ? updateExp(item.children) : []
                        };
                    });
                };
                return updateExp(targetNb!.sections);
            });

            this.expandedSections.update(s => {
                s.add(targetSecPath!);
                return s;
            });

            const currentSecs = get(this.sections);
            const targetSec = this.findSectionByPath(currentSecs, targetSecPath);
            if (targetSec) {
                this.selectSection(targetSec);
            }
        }
    }

    // =============================================
    // Drag & Drop
    // =============================================
    public handleDragStart(e: DragEvent, itemId: string, itemType: "notebook" | "section" | "page") {
        if (this.dragEndTimeout) clearTimeout(this.dragEndTimeout);
        this.draggedItemId.set(itemId);
        this.draggedItemType.set(itemType);
        if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", itemId);
            e.dataTransfer.setData("text/type", itemType);
            e.dataTransfer.effectAllowed = "move";
        }
    }

    public handleDragOver(e: DragEvent, itemId: string, _itemType: "notebook" | "section" | "page") {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

        const draggedId = get(this.draggedItemId);

        if (itemId === draggedId) {
            this.dragOverId.set("");
            this.dragPosition.set(null);
            return;
        }

        this.dragOverId.set(itemId);
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        this.dragPosition.set(relativeY < rect.height * 0.5 ? "top" : "bottom");
    }

    public async handleDrop(e: DragEvent, targetId: string, targetType: "notebook" | "section" | "page") {
        e.preventDefault();

        const pos = get(this.dragPosition);
        const dId = get(this.draggedItemId);
        const dType = get(this.draggedItemType);

        const movedId = dId || (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "");
        const movedType = dType || (e.dataTransfer ? (e.dataTransfer.getData("text/type") as any) : null);

        if (this.dragEndTimeout) clearTimeout(this.dragEndTimeout);
        this.draggedItemId.set("");
        this.draggedItemType.set(null);
        this.dragOverId.set("");
        this.dragPosition.set(null);

        if (!pos || !movedId || targetId === movedId || !this.plugin) return;

        // Notebook -> Notebook
        if (movedType === "notebook" && targetType === "notebook") {
            this.notebooks.update(nbs => this.reorderNotebookTree(nbs, movedId, targetId, pos!));
            const currentNbs = get(this.notebooks);
            
            await DragDropHelper.reorderNotebook(
                this.plugin.settings,
                () => this.plugin.saveSettings(),
                movedId,
                targetId,
                pos,
                currentNbs
            );
            this.loadNotebooks();
            return;
        }

        // Section -> Section
        if (movedType === "section" && targetType === "section") {
            const nb = get(this.selectedNotebook);
            if (!nb) return;

            this.sections.update(secs => this.reorderSectionTree(secs, movedId, targetId, pos!));
            const currentSecs = get(this.sections);

            await DragDropHelper.reorderSection(
                this.plugin.settings,
                () => this.plugin.saveSettings(),
                movedId,
                targetId,
                pos,
                currentSecs,
                nb.folderPath
            );
            this.loadNotebooks();
            return;
        }

        // Page -> Page
        if (movedType === "page" && targetType === "page") {
            const sec = get(this.selectedSection);
            if (!sec) return;

            const isSibling = this.checkPagesAreSiblings(sec.pages, movedId, targetId);
            if (!isSibling) {
                new Notice("必须同级才能拖拽 / Only sibling pages can be reordered");
                return;
            }

            const newPages = this.reorderPageTree(sec.pages, movedId, targetId, pos);
            this.selectedSection.update(s => s ? { ...s, pages: newPages } : null);
            
            await DragDropHelper.reorderPage(
                this.plugin.settings,
                () => this.plugin.saveSettings(),
                movedId,
                targetId,
                pos,
                newPages,
                sec.folderPath
            );
            this.loadNotebooks();
            return;
        }

        // Page/Section -> Section/Notebook
        if ((movedType === "page" || movedType === "section") && (targetType === "section" || targetType === "notebook")) {
            const abstractFile = this.app.vault.getAbstractFileByPath(movedId);
            if (abstractFile) {
                await DragDropHelper.movePageToSection(this.app, { name: abstractFile.name, filepath: abstractFile.path, folderPath: abstractFile.path }, targetId);
                this.loadNotebooks();
            }
            return;
        }
    }

    public handleDragEnd() {
        if (this.dragEndTimeout) clearTimeout(this.dragEndTimeout);
        this.dragEndTimeout = setTimeout(() => {
            this.draggedItemId.set("");
            this.draggedItemType.set(null);
            this.dragOverId.set("");
            this.dragPosition.set(null);
        }, 50);
    }

    // =============================================
    // Helpers
    // =============================================
    private checkFolderExists(path: string): boolean {
        if (path === "/") return true;
        const file = this.app.vault.getAbstractFileByPath(path);
        return !!file;
    }

    private findSectionByPath(list: SectionInfo[], path: string): SectionInfo | null {
        for (const sec of list) {
            if (sec.folderPath === path) return sec;
            if (sec.children) {
                const found = this.findSectionByPath(sec.children, path);
                if (found) return found;
            }
        }
        return null;
    }

    private flattenVisibleSections(items: SectionInfo[], depth = 0): (SectionInfo & { _depth: number })[] {
        let result: (SectionInfo & { _depth: number })[] = [];
        for (const item of items) {
            result.push({ ...item, _depth: depth });
            if (item.isExpanded && item.children && item.children.length > 0) {
                result = result.concat(this.flattenVisibleSections(item.children, depth + 1));
            }
        }
        return result;
    }

    private getAllPagesRecursive(sectionsList: SectionInfo[]): (PageInfo & { sectionName?: string })[] {
        let result: (PageInfo & { sectionName?: string })[] = [];
        for (const sec of sectionsList) {
            if (sec.pages) {
                result.push(...sec.pages.map(p => ({ ...p, sectionName: sec.name })));
            }
            if (sec.children) {
                result.push(...this.getAllPagesRecursive(sec.children));
            }
        }
        return result;
    }

    private findSectionPathContainingPage(list: SectionInfo[], filepath: string): string | null {
        for (const sec of list) {
            const hasPage = this.findPageRecursive(sec.pages, filepath);
            if (hasPage) return sec.folderPath;
            if (sec.children) {
                const found = this.findSectionPathContainingPage(sec.children, filepath);
                if (found) return found;
            }
        }
        return null;
    }

    private findPageRecursive(pages: PageInfo[], filepath: string): boolean {
        for (const p of pages) {
            if (p.filepath === filepath) return true;
            if (p.children && this.findPageRecursive(p.children, filepath)) return true;
        }
        return false;
    }

    private getSectionAncestors(list: SectionInfo[], targetPath: string, currentPath: string[] = []): string[] {
        for (const sec of list) {
            if (sec.folderPath === targetPath) return currentPath;
            if (sec.children) {
                const found = this.getSectionAncestors(sec.children, targetPath, [...currentPath, sec.folderPath]);
                if (found.length > 0) return found;
            }
        }
        return [];
    }

    private checkPagesAreSiblings(list: PageInfo[], sourcePath: string, targetPath: string): boolean {
        const normSource = PathUtils.normalize(sourcePath);
        const normTarget = PathUtils.normalize(targetPath);
        function checkInList(items: PageInfo[]): boolean | null {
            const hasSource = items.some(p => PathUtils.normalize(p.filepath) === normSource);
            const hasTarget = items.some(p => PathUtils.normalize(p.filepath) === normTarget);
            if (hasSource && hasTarget) return true;
            if (hasSource || hasTarget) return false;
            for (const item of items) {
                if (item.children && item.children.length > 0) {
                    const res = checkInList(item.children);
                    if (res !== null) return res;
                }
            }
            return null;
        }
        return checkInList(list) === true;
    }

    private reorderNotebookTree(list: NotebookInfo[], sourcePath: string, targetPath: string, pos: "top" | "bottom"): NotebookInfo[] {
        const normSource = PathUtils.normalize(sourcePath);
        const normTarget = PathUtils.normalize(targetPath);
        const sourceItem = list.find(n => PathUtils.normalize(n.folderPath) === normSource);
        if (!sourceItem) return list;

        const filtered = list.filter(n => PathUtils.normalize(n.folderPath) !== normSource);
        const targetIdx = filtered.findIndex(n => PathUtils.normalize(n.folderPath) === normTarget);
        if (targetIdx !== -1) {
            const insertIdx = pos === "top" ? targetIdx : targetIdx + 1;
            filtered.splice(insertIdx, 0, sourceItem);
        }
        return filtered;
    }

    private reorderSectionTree(list: SectionInfo[], sourcePath: string, targetPath: string, pos: "top" | "bottom"): SectionInfo[] {
        const normSource = PathUtils.normalize(sourcePath);
        const normTarget = PathUtils.normalize(targetPath);
        const sourceItem = list.find(s => PathUtils.normalize(s.folderPath) === normSource);
        if (!sourceItem) return list;

        const filtered = list.filter(s => PathUtils.normalize(s.folderPath) !== normSource);
        const targetIdx = filtered.findIndex(s => PathUtils.normalize(s.folderPath) === normTarget);
        if (targetIdx !== -1) {
            const insertIdx = pos === "top" ? targetIdx : targetIdx + 1;
            filtered.splice(insertIdx, 0, sourceItem);
        }
        return filtered;
    }

    private reorderPageTree(list: PageInfo[], sourcePath: string, targetPath: string, pos: "top" | "bottom"): PageInfo[] {
        const normSource = PathUtils.normalize(sourcePath);
        const normTarget = PathUtils.normalize(targetPath);
        function updateList(items: PageInfo[]): PageInfo[] {
            const hasSource = items.some(p => PathUtils.normalize(p.filepath) === normSource);
            const hasTarget = items.some(p => PathUtils.normalize(p.filepath) === normTarget);
            if (hasSource && hasTarget) {
                const sourceItem = items.find(p => PathUtils.normalize(p.filepath) === normSource)!;
                const filtered = items.filter(p => PathUtils.normalize(p.filepath) !== normSource);
                const targetIdx = filtered.findIndex(p => PathUtils.normalize(p.filepath) === normTarget);
                if (targetIdx !== -1) {
                    const insertIdx = pos === "top" ? targetIdx : targetIdx + 1;
                    filtered.splice(insertIdx, 0, sourceItem);
                    return filtered;
                }
            }
            return items.map(s => ({
                ...s,
                children: s.children && s.children.length > 0 ? updateList(s.children) : []
            }));
        }
        return updateList(list);
    }
}
