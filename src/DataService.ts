import { App } from "obsidian";
import { NotebookInfo, SectionInfo, PageInfo } from "./types";
import { VaultScanner } from "./services/VaultScanner";
import { PathUtils } from "./utils/PathUtils";

export class DataService {
    private scanner: VaultScanner;

    constructor(app: App) {
        this.scanner = new VaultScanner(app);
    }

    getNotebooks(
        rootFolder: string,
        customNotebookOrder: string[] = [],
        customSectionOrderMap: Record<string, string[]> = {},
        customPageOrder: Record<string, string[]> = {}
    ): NotebookInfo[] {
        const rawNotebooks = this.scanner.scanNotebooks(rootFolder);
        
        // Sort Notebooks
        const sortedNotebooks = DataService.sortNotebooksWithCustomOrder(rawNotebooks, customNotebookOrder);

        return sortedNotebooks.map(nb => {
            const sectionOrder = customSectionOrderMap[PathUtils.normalize(nb.folderPath)] ?? [];
            const sortedSections = DataService.sortSectionsWithCustomOrder(nb.sections, sectionOrder);

            const processedSections = sortedSections.map(sec => {
                const pageOrder = customPageOrder[PathUtils.normalize(sec.folderPath)] ?? [];
                const sortedPages = DataService.sortPagesWithCustomOrder(sec.pages, pageOrder);
                return {
                    ...sec,
                    pages: sortedPages
                };
            });

            return {
                ...nb,
                sections: processedSections
            };
        });
    }

    getSections(
        rootFolder: string, 
        customSectionOrder: string[] = [], 
        customPageOrder: Record<string, string[]> = {},
        customSectionOrderMap: Record<string, string[]> = {}
    ): SectionInfo[] {
        const notebooks = this.getNotebooks(rootFolder, [], customSectionOrderMap, customPageOrder);
        if (notebooks.length > 0) {
            return notebooks[0].sections;
        }
        return [];
    }

    /**
     * Pure utility to extract parent folder path from a file path
     */
    static getSectionFolderPathFromFile(filepath: string): string {
        if (!filepath) return "";
        const parts = filepath.split("/");
        parts.pop(); // Remove filename
        return parts.join("/");
    }

    /**
     * Flatten visible expanded pages matching DOM tree layout
     */
    static getFlattenedPages(pages: PageInfo[]): PageInfo[] {
        const result: PageInfo[] = [];
        function recurse(list: PageInfo[]) {
            for (const p of list) {
                result.push(p);
                if (p.isExpanded && p.children && p.children.length > 0) {
                    recurse(p.children);
                }
            }
        }
        recurse(pages);
        return result;
    }

    /**
     * Sort pages according to user custom drag & drop order
     */
    static sortPagesWithCustomOrder(pages: PageInfo[], customOrder: string[]): PageInfo[] {
        if (!customOrder || customOrder.length === 0) return pages;
        const orderMap = new Map<string, number>();
        customOrder.forEach((path, idx) => orderMap.set(PathUtils.normalize(path), idx));

        return [...pages].sort((a, b) => {
            const normA = PathUtils.normalize(a.filepath);
            const normB = PathUtils.normalize(b.filepath);
            const indexA = orderMap.has(normA) ? orderMap.get(normA)! : 999999;
            const indexB = orderMap.has(normB) ? orderMap.get(normB)! : 999999;
            return indexA - indexB;
        });
    }

    /**
     * Sort sections according to user custom drag & drop order
     */
    static sortSectionsWithCustomOrder(sections: SectionInfo[], customOrder: string[]): SectionInfo[] {
        if (!customOrder || customOrder.length === 0) return sections;
        const orderMap = new Map<string, number>();
        customOrder.forEach((path, idx) => orderMap.set(PathUtils.normalize(path), idx));

        return [...sections].sort((a, b) => {
            const normA = PathUtils.normalize(a.folderPath);
            const normB = PathUtils.normalize(b.folderPath);
            const indexA = orderMap.has(normA) ? orderMap.get(normA)! : 999999;
            const indexB = orderMap.has(normB) ? orderMap.get(normB)! : 999999;
            return indexA - indexB;
        });
    }

    /**
     * Sort notebooks according to user custom drag & drop order
     */
    static sortNotebooksWithCustomOrder(notebooks: NotebookInfo[], customOrder: string[]): NotebookInfo[] {
        if (!customOrder || customOrder.length === 0) return notebooks;
        const orderMap = new Map<string, number>();
        customOrder.forEach((path, idx) => orderMap.set(PathUtils.normalize(path), idx));

        return [...notebooks].sort((a, b) => {
            const normA = PathUtils.normalize(a.folderPath);
            const normB = PathUtils.normalize(b.folderPath);
            const indexA = orderMap.has(normA) ? orderMap.get(normA)! : 999999;
            const indexB = orderMap.has(normB) ? orderMap.get(normB)! : 999999;
            return indexA - indexB;
        });
    }
}
