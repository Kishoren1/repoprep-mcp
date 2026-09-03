import { parseText } from "./textParser.js";
import { isLikelyBinary } from "../core/fileFilters.js";
import type { ParseResult } from "../core/contextBuilder.js";

const TEXT_EXTS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "java",
  "rs",
  "php",
  "cs",
  "cpp",
  "c",
  "h",
  "swift",
  "kt",
  "scala",
  "r",
  "lua",
  "html",
  "css",
  "scss",
  "sass",
  "less",
  "svelte",
  "vue",
  "json",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "xml",
  "graphql",
  "gql",
  "prisma",
  "sql",
  "env",
  "md",
  "mdx",
  "txt",
  "rst",
  "tex",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "prettierrc",
  "eslintrc",
  "babelrc",
  "dockerfile",
  "makefile",
]);

const DOTFILE_NAMES = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".babelrc",
  ".env",
  ".env.local",
  ".env.example",
  "dockerfile",
  "makefile",
  "procfile",
  "gemfile",
  "rakefile",
  "brewfile",
]);

export async function parseFile(
  absPath: string,
  relPath: string,
): Promise<ParseResult> {
  const name = relPath.split("/").pop() ?? relPath;
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";

  try {
    let content = "";

    if (DOTFILE_NAMES.has(lower) || TEXT_EXTS.has(ext)) {
      content = await parseText(absPath);
    } else {
      try {
        const text = await parseText(absPath);
        content = isLikelyBinary(text)
          ? "[Binary file — content not extracted]"
          : text;
      } catch {
        content = "[Binary or unsupported file — content not extracted]";
      }
    }

    const MAX_CHARS = 100_000;
    if (content.length > MAX_CHARS) {
      content =
        content.slice(0, MAX_CHARS) +
        `\n\n[... truncated — file exceeded ${MAX_CHARS.toLocaleString("en-US")} characters ...]`;
    }

    return { path: relPath, content, error: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      path: relPath,
      content: `[Failed to parse: ${message}]`,
      error: true,
    };
  }
}

export interface BatchParseResult {
  results: ParseResult[];
  failed: number;
  total: number;
}

export async function parseFiles(
  files: Array<{ absPath: string; relPath: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<BatchParseResult> {
  const results: ParseResult[] = [];
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const { absPath, relPath } = files[i];
    const result = await parseFile(absPath, relPath);
    results.push(result);
    if (result.error) failed++;
    onProgress?.(i + 1, files.length);
  }

  return { results, failed, total: files.length };
}
