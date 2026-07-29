/**
 * PathUtils.ts
 * Utility for normalizing file and folder paths to guarantee exact ID matching.
 */
export class PathUtils {
    /**
     * Normalize a path string by removing leading/trailing slashes, trimming whitespace,
     * and converting backslashes to forward slashes.
     */
    static normalize(path: string): string {
        if (!path) return "";
        return path
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+/, "")
            .replace(/\/+$/, "");
    }

    /**
     * Compare two paths for equality after normalization.
     */
    static isEqual(pathA: string, pathB: string): boolean {
        return PathUtils.normalize(pathA) === PathUtils.normalize(pathB);
    }
}
