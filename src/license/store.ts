import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(homedir(), ".repoprep");
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export interface StoredToken {
  token: string;
  email: string;
  cachedAt: number;
}

export async function readStoredToken(): Promise<StoredToken | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.token || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeStoredToken(data: StoredToken): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function clearStoredToken(): Promise<void> {
  try {
    await rm(TOKEN_FILE, { force: true });
  } catch {
    /* ignore */
  }
}
