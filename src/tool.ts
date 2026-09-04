import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { walkDirectory } from "./walk.js";
import { parseFiles } from "./parsers/index.js";
import { buildContext, type ContextOutput } from "./core/contextBuilder.js";
import { getLimits } from "./core/limits.js";
import {
  MAX_RESPONSE_BYTES,
  measureResponseBytes,
} from "./core/responseSize.js";
import {
  getEffectiveTier,
  activateLicense,
  deactivateLicense,
} from "./license/verify.js";

export const getCodebaseContextSchema = {
  path: z
    .string()
    .describe(
      "Absolute path to the project folder to read. Relative paths are resolved against the directory the MCP server was started in, which may not match the user's intent — ask for or confirm an absolute path when unsure.",
    ),
  max_files: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional cap on number of files to include, on top of the account's tier limit (never higher than it).",
    ),
};

const getCodebaseContextInput = z.object(getCodebaseContextSchema);

export async function handleGetCodebaseContext(
  rawInput: z.infer<typeof getCodebaseContextInput>,
) {
  const targetPath = path.resolve(process.cwd(), rawInput.path);

  let stats;
  try {
    stats = await stat(targetPath);
  } catch {
    return errorResult(
      `Couldn't find "${targetPath}". Check the path exists and is accessible to this process.`,
    );
  }

  if (!stats.isDirectory()) {
    return errorResult(`"${targetPath}" is not a directory.`);
  }

  const { isPro } = await getEffectiveTier();
  const tierLimits = getLimits(isPro);

  const effectiveMaxFiles = rawInput.max_files
    ? Math.min(rawInput.max_files, tierLimits.maxFiles)
    : tierLimits.maxFiles;

  const walkResult = await walkDirectory(targetPath, {
    maxFiles: effectiveMaxFiles,
    maxTotalSizeBytes: tierLimits.maxTotalSizeBytes,
  });

  if (walkResult.files.length === 0) {
    return errorResult(
      "No usable files found — everything was filtered out as noise, build output, or a secret file, or the folder is empty.",
    );
  }

  const { results } = await parseFiles(
    walkResult.files.map((f) => ({ absPath: f.absPath, relPath: f.relPath })),
  );

  const sourceName = path.basename(targetPath);

  const notes: string[] = [];
  if (walkResult.secretFiles.length > 0) {
    notes.push(
      `Excluded for security — never read: ${walkResult.secretFiles.join(", ")}.`,
    );
  }
  const noiseSkippedCount =
    walkResult.skippedCount - walkResult.secretFiles.length;
  if (noiseSkippedCount > 0) {
    notes.push(
      `${noiseSkippedCount} additional file${noiseSkippedCount === 1 ? "" : "s"} skipped as noise or build output (e.g. node_modules, lockfiles, .git) — same filtering as repoprep.com.`,
    );
  }
  if (walkResult.truncated) {
    const callerRequestedLowerCap =
      rawInput.max_files !== undefined &&
      rawInput.max_files < tierLimits.maxFiles;

    if (walkResult.truncationReason === "max_size") {
      notes.push(
        isPro
          ? `Stopped at the Pro size limit (${tierLimits.maxTotalSizeMB} MB total). Some files in this folder were not included — this is a size cap, not a file-count cap, so max_files won't change it.`
          : `Stopped at the free size limit (${tierLimits.maxTotalSizeMB} MB total). Some files in this folder were not included — this is a size cap, not a file-count cap, so max_files won't change it. Activate a Pro license with repoprep_activate_pro for 20 MB total.`,
      );
    } else if (callerRequestedLowerCap) {
      notes.push(
        `Stopped at the requested max_files limit (${effectiveMaxFiles}). Some files in this folder were not included — raise max_files to include more, up to your tier limit of ${tierLimits.maxFiles}.`,
      );
    } else {
      notes.push(
        isPro
          ? `Stopped at the Pro limit (${tierLimits.maxFiles} files). Some files in this folder were not included.`
          : `Stopped at the free limit (${tierLimits.maxFiles} files). Some files in this folder were not included — activate a Pro license with repoprep_activate_pro for 200 files / 20 MB.`,
      );
    }
  }

  const renderText = (out: ContextOutput, extraNotes: string[]): string => {
    const allNotes = [...notes, ...extraNotes];
    return allNotes.length > 0
      ? `${out.text}\n[${allNotes.join(" ")}]\n`
      : out.text;
  };

  let output = buildContext(results, sourceName);
  let finalText = renderText(output, []);

  if (measureResponseBytes(finalText) > MAX_RESPONSE_BYTES) {
    let lo = 0;
    let hi = results.length;
    let bestCount = 0;
    let bestOutput = output;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidateOutput = buildContext(results.slice(0, mid), sourceName);
      const candidateNote = `Response trimmed to ${mid} of ${results.length} files to stay under this MCP client's ~1 MB tool-result limit — a separate, often smaller ceiling than your repoprep tier. Ask about a narrower path, or use max_files, to see the rest.`;
      const candidateText = renderText(candidateOutput, [candidateNote]);

      if (measureResponseBytes(candidateText) <= MAX_RESPONSE_BYTES) {
        bestCount = mid;
        bestOutput = candidateOutput;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    output = bestOutput;
    const finalNote = `Response trimmed to ${bestCount} of ${results.length} files to stay under this MCP client's ~1 MB tool-result limit — a separate, often smaller ceiling than your repoprep tier. Ask about a narrower path, or use max_files, to see the rest.`;
    finalText = renderText(output, [finalNote]);
  }

  return {
    content: [{ type: "text" as const, text: finalText }],
  };
}

export const activateProSchema = {
  email: z
    .string()
    .email()
    .describe("The email address used for the Gumroad purchase."),
  licenseKey: z
    .string()
    .min(10)
    .describe("The license key from the Gumroad receipt email."),
};

const activateProInput = z.object(activateProSchema);

export async function handleActivatePro(
  rawInput: z.infer<typeof activateProInput>,
) {
  const result = await activateLicense(rawInput.email, rawInput.licenseKey);

  if (!result.ok) {
    return errorResult(result.message);
  }

  return {
    content: [{ type: "text" as const, text: result.message }],
  };
}

export const deactivateProSchema = {};

export async function handleDeactivatePro() {
  const result = await deactivateLicense();

  return {
    content: [{ type: "text" as const, text: result.message }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
