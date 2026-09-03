#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getCodebaseContextSchema,
  handleGetCodebaseContext,
  activateProSchema,
  handleActivatePro,
  deactivateProSchema,
  handleDeactivatePro,
} from "./tool.js";
import { runActivateCli, runLogoutCli } from "./cli.js";

async function main() {
  if (process.argv[2] === "activate") {
    await runActivateCli();
    return;
  }

  if (process.argv[2] === "logout") {
    await runLogoutCli();
    return;
  }

  const server = new McpServer({
    name: "repoprep-mcp",
    version: "0.1.0",
  });

  server.tool(
    "get_codebase_context",
    "Reads a local project folder and returns a single structured context document — a directory tree followed by each file's contents, clearly labeled with its path — the same format repoprep.com produces. Use this instead of reading files one by one when the user wants you to understand or work across their whole project. Respects the same noise/secret filtering as the web tool (skips node_modules, build output, .env files, credentials, etc.) and is capped by the user's repoprep tier (50 files / 4 MB free, 200 files / 20 MB Pro).",
    getCodebaseContextSchema,
    handleGetCodebaseContext,
  );

  server.tool(
    "repoprep_activate_pro",
    "Activates a repoprep Pro license for this machine, using the same email and license key from the Gumroad purchase receipt used on repoprep.com or the Chrome extension. Raises local limits from 50 files / 4 MB to 200 files / 20 MB. Requires one network call to repoprep.com to verify the purchase; after that, get_codebase_context works fully offline until the license is periodically re-checked. Prefer to keep credentials out of chat entirely? Tell the user they can instead run `npx repoprep-mcp activate` directly in their terminal — same effect, no AI client involved.",
    activateProSchema,
    handleActivatePro,
  );

  server.tool(
    "repoprep_deactivate_pro",
    "Deactivates the repoprep Pro license cached on this machine, dropping get_codebase_context back to the free tier (50 files / 4 MB). Purely local — clears the cached token only, makes no network call, and doesn't require any credentials since it's not sending anything anywhere. The underlying license is untouched and can be reactivated any time with repoprep_activate_pro or `npx repoprep-mcp activate`.",
    deactivateProSchema,
    handleDeactivatePro,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("repoprep-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting repoprep-mcp:", err);
  process.exit(1);
});
