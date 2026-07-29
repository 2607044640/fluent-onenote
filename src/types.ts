/**
 * types.ts
 * Central type definitions and constants for the A1OneNote plugin.
 */

export { VIEW_TYPE_SECTIONS, VIEW_TYPE_PAGES } from "./constants";

export type DisplayMode = "floating" | "both";

export interface RecentPageItem {
    filepath: string;
    timestamp: number;
}


// =============================================
// Data Models
// =============================================
export interface PageInfo {
    /** 笔记标题（不含 .md 后缀） */
    name: string;
    /** vault 内 the relative path, e.g. "OneNote/Original Game/Design/todo.md" */
    filepath: string;
    /** 若该笔记同时也是一个包含子页面的文件夹，记录该文件夹路径 */
    folderPath?: string;
    /** 子笔记/子页面列表 */
    children?: PageInfo[];
    /** UI 折叠展开状态 */
    isExpanded?: boolean;
    /** 搜索匹配时的所属分区名 */
    sectionName?: string;
}

export interface SectionInfo {
    /** 分区唯一标识，使用 folderPath */
    id: string;
    /** 分区名（文件夹名） */
    name: string;
    /** vault 内 the relative path, e.g. "OneNote/Original Game/Design" */
    folderPath: string;
    /** 该分区下的笔记列表 */
    pages: PageInfo[];
    /** 子分区列表 */
    children: SectionInfo[];
    /** UI 折叠状态 */
    isExpanded: boolean;
}

export interface NotebookInfo {
    id: string;
    name: string;
    folderPath: string;
    sections: SectionInfo[];
}

export interface SectionSelectedPayload {
    section: SectionInfo | null;
    sourceId?: string;
}

export interface PageSelectedPayload {
    page: PageInfo;
    sourceId?: string;
}

export interface ExpandedSectionsChangedPayload {
    paths: string[];
    sourceId?: string;
}

// =============================================
// Event Name Registry
// =============================================
export enum EventName {
    SECTION_SELECTED = "section:selected",
    PAGE_SELECTED = "page:selected",
    EXPANDED_SECTIONS_CHANGED = "sections:expanded_changed",
}

