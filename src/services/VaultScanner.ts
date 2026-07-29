import { App, TFolder, TFile } from "obsidian";
import { NotebookInfo, SectionInfo, PageInfo } from "../types";

export class VaultScanner {
    constructor(private app: App) {}

    /**
     * Scan rootFolder as 3-tier structure:
     * Notebooks (top-level folders under root)
     *   └── Sections (sub-folders inside notebook)
     *         └── Pages (notes inside section, supporting multi-level sub-pages)
     */
    scanNotebooks(rootFolder: string): NotebookInfo[] {
        const rootPath = rootFolder.trim();
        const rootAbstract = rootPath === "" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(rootPath);
        
        if (!rootAbstract || !(rootAbstract instanceof TFolder)) {
            return [];
        }

        const notebooks: NotebookInfo[] = [];

        // Collect top-level folders under root as Notebooks
        for (const child of rootAbstract.children) {
            if (child instanceof TFolder) {
                notebooks.push(this.buildNotebook(child));
            }
        }

        // Fallback: If no top-level folders exist, treat root folder itself as a single Notebook
        if (notebooks.length === 0) {
            notebooks.push({
                id: rootAbstract.path,
                name: rootAbstract.name || "Default Notebook",
                folderPath: rootAbstract.path,
                sections: this.scanSectionsUnderFolder(rootAbstract)
            });
        }

        return notebooks;
    }

    private buildNotebook(folder: TFolder): NotebookInfo {
        const sections: SectionInfo[] = [];

        // 1-level flat section folders inside notebook
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                sections.push(this.buildFlatSection(child));
            }
        }

        // Collect loose notes directly under Notebook into a "General" section if any exist
        const loosePages: PageInfo[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === "md" && !child.name.startsWith(".")) {
                if (child.basename !== folder.name) {
                    loosePages.push(this.buildPageTree(child));
                }
            }
        }

        if (loosePages.length > 0) {
            sections.unshift({
                id: `${folder.path}/_general`,
                name: "General",
                folderPath: folder.path,
                pages: loosePages,
                children: [],
                isExpanded: true
            });
        }

        return {
            id: folder.path,
            name: folder.name,
            folderPath: folder.path,
            sections
        };
    }

    private buildFlatSection(folder: TFolder): SectionInfo {
        const pages: PageInfo[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === "md" && !child.name.startsWith(".")) {
                if (child.basename === folder.name) continue;
                pages.push(this.buildPageTree(child));
            } else if (child instanceof TFolder) {
                // If there's a sub-folder inside a Section, convert it into a parent Page with sub-pages!
                pages.push(this.buildFolderAsPage(child));
            }
        }

        return {
            id: folder.path,
            name: folder.name,
            folderPath: folder.path,
            pages,
            children: [], // Sections are 1-level flat, no sub-sections!
            isExpanded: true
        };
    }

    private buildFolderAsPage(folder: TFolder): PageInfo {
        const children: PageInfo[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === "md" && !child.name.startsWith(".")) {
                if (child.basename === folder.name) continue;
                children.push(this.buildPageTree(child));
            } else if (child instanceof TFolder) {
                children.push(this.buildFolderAsPage(child));
            }
        }

        const folderNote = folder.children.find(c => c instanceof TFile && c.basename === folder.name) as TFile | undefined;

        return {
            name: folder.name,
            filepath: folderNote ? folderNote.path : `${folder.path}/${folder.name}.md`,
            folderPath: folder.path,
            children,
            isExpanded: false
        };
    }

    private buildPageTree(file: TFile): PageInfo {
        return {
            name: file.basename,
            filepath: file.path
        };
    }

    private scanSectionsUnderFolder(folder: TFolder): SectionInfo[] {
        const sections: SectionInfo[] = [];
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                sections.push(this.buildFlatSection(child));
            }
        }
        return sections;
    }
}
