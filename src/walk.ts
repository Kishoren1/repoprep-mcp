import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { shouldSkipPath, getSkipReason } from "./core/fileFilters.js";

export interface WalkedFile {
  absPath: string;
  relPath: string;
  size: number;
}

export type TruncationReason = "max_files" | "max_size" | null;

export interface WalkResult {
  files: WalkedFile[];
  skippedCount: number;
  secretFiles: string[];
  truncated: boolean;
  truncationReason: TruncationReason;
}

export interface WalkOptions {
  maxFiles: number;
  maxTotalSizeBytes: number;
}

const toPosix = (p: string): string => p.split(path.sep).join("/");

export async function walkDirectory(
  rootDir: string,
  options: WalkOptions,
): Promise<WalkResult> {
  const eligibleFiles: WalkedFile[] = [];
  let skippedCount = 0;
  const secretFiles: string[] = [];

  async function walk(dir: string, relDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Unreadable directory (permissions, etc.) — skip it, don't fail the whole walk.
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

      if (entry.isSymbolicLink()) {
        skippedCount++;
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldSkipPath(relPath)) {
          skippedCount++;
          continue;
        }
        await walk(absPath, relPath);
        continue;
      }

      if (!entry.isFile()) {
        skippedCount++;
        continue;
      }

      const skipReason = getSkipReason(entry.name, relPath);
      if (skipReason) {
        skippedCount++;
        if (skipReason === "secret") {
          secretFiles.push(toPosix(relPath));
        }
        continue;
      }

      let size = 0;
      try {
        size = (await stat(absPath)).size;
      } catch {
        skippedCount++;
        continue;
      }

      eligibleFiles.push({ absPath, relPath: toPosix(relPath), size });
    }
  }

  await walk(rootDir, "");

  const files: WalkedFile[] = [];
  let totalBytes = 0;
  let truncated = false;
  let truncationReason: TruncationReason = null;

  for (const file of eligibleFiles) {
    if (files.length >= options.maxFiles) {
      truncated = true;
      truncationReason = "max_files";
      break;
    }
    if (totalBytes + file.size > options.maxTotalSizeBytes) {
      truncated = true;
      truncationReason = "max_size";
      break;
    }
    files.push(file);
    totalBytes += file.size;
  }

  return { files, skippedCount, secretFiles, truncated, truncationReason };
}
