# repoprep-mcp

**Local-first MCP server for [repoprep](https://www.repoprep.com)** — turn a project folder into AI-ready context, directly inside Claude. No copy-paste, no upload, same filtering engine as the web app.

[![npm version](https://img.shields.io/npm/v/repoprep-mcp.svg)](https://www.npmjs.com/package/repoprep-mcp)
[![license](https://img.shields.io/npm/l/repoprep-mcp.svg)](https://github.com/Kishoren1/repoprep-mcp/blob/main/LICENSE)

---

## What this is

repoprep.com converts a project folder into a single, structured context document — a directory tree followed by each file's contents, clearly labeled — for pasting into an AI chat. `repoprep-mcp` does the same job, but as a tool Claude can call directly during a conversation. Ask Claude to look at your project, and it reads the folder itself instead of you copying and pasting files one at a time.

Everything runs locally on your machine. Your code is read from disk and handed straight to Claude in the same process — it never passes through a repoprep server, and reading or processing your files never touches the network, on any tier. The only network activity this tool ever performs is license-related: one request when you activate Pro, and an occasional background check after that (see [Activating Pro](#activating-pro) below).

This is an _additional_ way to use repoprep, not a replacement for the [web app](https://www.repoprep.com) or the [Chrome extension](https://chromewebstore.google.com/detail/repoprep/ocafmohghoihkdmmedcddpbggengjonc) — use whichever fits the moment. The web app also handles PDF, DOCX, and XLSX files (the extension doesn't, same as this MCP server); this MCP server is scoped to source and text files (see [Supported file types](#supported-file-types) for why).

## Requirements

- [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.com/claude-code), with MCP support
- Node.js 18 or later installed on your machine (`node -v` to check)

## Quick start

Add this to your MCP configuration — in Claude Desktop, that's `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "repoprep": {
      "command": "npx",
      "args": ["-y", "repoprep-mcp"]
    }
  }
}
```

Restart Claude Desktop, then just ask it to work on a project:

> "Use repoprep to look at my project at C:\Users\me\Projects\my-app and tell me how the auth flow works."

No install step beyond that — `npx` fetches the package the first time it's needed and Claude runs it directly.

## Tools

### `get_codebase_context`

Reads a local project folder and returns one structured context document — a directory tree, then each file's contents, clearly labeled with its path. This is the core tool; Claude reaches for it automatically whenever a task benefits from seeing your whole project rather than one file at a time.

| Parameter   | Required | Description                                                                                                                                                                                                       |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`      | Yes      | Absolute path to the project folder. Relative paths resolve against the directory the MCP server was started in, which usually isn't what you mean — give Claude the full path, or let it ask you to confirm one. |
| `max_files` | No       | Optional cap below your tier's limit, for narrowing a request to a subfolder or a smaller slice of a large project.                                                                                               |

**Example prompts:**

> "Read the codebase at /Users/me/repos/api-server and explain the folder structure."

> "Pull context from D:\Projects\dashboard and refactor the login component to use the new auth hook."

### `repoprep_activate_pro`

Activates a repoprep Pro license on this machine, using the same email and license key from your Gumroad purchase receipt — the same license that unlocks the web app and the Chrome extension. Requires one network call to repoprep.com. See [Activating Pro](#activating-pro) below — including a terminal-only way to do this without typing your credentials into a chat at all.

| Parameter    | Required | Description                                      |
| ------------ | -------- | ------------------------------------------------ |
| `email`      | Yes      | The email address used for the purchase.         |
| `licenseKey` | Yes      | The license key from your Gumroad receipt email. |

**Example prompt:**

> "Activate my repoprep Pro license — my email is jane@example.com and the key is XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX."

Some AI clients will decline to run this even though it's completely safe — sending credentials on your behalf, even to your own account on your own server, is exactly the kind of thing a cautious assistant is right to hesitate on. If that happens, use `npx repoprep-mcp activate` instead (see [Activating Pro](#activating-pro)) — it does the identical thing without an AI in the loop at all.

### `repoprep_deactivate_pro`

Clears the Pro license cached on this machine, dropping `get_codebase_context` back to the free tier. Takes no parameters. Purely local — makes no network call and needs no credentials, since it's only deleting a local file, not talking to a server. Your underlying license is untouched; reactivate any time with the same email and key.

**Example prompt:**

> "Deactivate my repoprep Pro license on this machine."

## Free vs. Pro

|                        | Free | Pro                                      |
| ---------------------- | ---- | ---------------------------------------- |
| Files per request      | 50   | 200                                      |
| Total size per request | 4 MB | 20 MB                                    |
| Price                  | —    | $6 one-time via Gumroad, no subscription |

These match the web app's limits exactly, on purpose — the same project should behave the same way regardless of which repoprep surface you're using.

No license is required to use `get_codebase_context` at all — it works immediately at the free tier. Pro just raises the ceiling for larger projects.

Already bought Pro on the web app or the extension? The same email and license key activate it here too — it's one purchase, usable everywhere.

## Activating Pro

There are two ways to activate. **The terminal is the recommended one** — it's guaranteed to work every time; the in-chat route depends on your AI client's judgment call and may not.

**In your terminal (recommended), with no AI involved at all:**

```bash
npx repoprep-mcp activate
```

This prompts you directly in the terminal for your email and license key, verifies them with repoprep.com, and writes the result to `~/.repoprep/token.json`. No AI client sees or handles your credentials at any point. Once it succeeds, every MCP client on the machine — Claude Desktop, Claude Code, or anything else — picks up the higher limits automatically, with nothing further to configure. This also sidesteps a real, common outcome: many AI assistants are (correctly) cautious about sending credentials out on a user's behalf, even to a service the user owns, and will decline an in-chat activation request even though it's completely safe.

**In chat, as an alternative.** Ask Claude to run `repoprep_activate_pro` with your email and license key — see the example prompt under [Tools](#tools) above. This makes one network request to repoprep.com to verify the purchase and writes to the same `~/.repoprep/token.json` file. It works when your AI client is willing to run it, but don't be surprised if it declines; that's the client behaving responsibly around credential-sharing, not a bug in this tool. If it happens, fall back to the terminal command above — same outcome either way.

Roughly once a day, if Pro is active, a background check quietly re-confirms the license with repoprep.com. This never blocks a request while it runs, and it exists specifically to catch server-side revocation (a refund or chargeback) — token expiry itself is checked locally, with no network needed, on every call.

License checks are the only reason this tool ever talks to a network. Reading and processing your files never does, regardless of tier or how long the server has been running.

## Deactivating Pro

Same two options as activating, and this direction has no trust trade-off either way, since no credentials are involved in logging out:

**In chat:** ask Claude to run `repoprep_deactivate_pro`.

**In your terminal:**

```bash
npx repoprep-mcp logout
```

Both just delete the cached token — your Gumroad license itself is never touched, so reactivating later needs nothing new.

## What gets filtered automatically

Every folder is filtered before anything is read — this logic is identical to the web app's, so the same project produces the same result on either surface:

- **Noise** — `node_modules`, `.git`, build output (`dist`, `build`, `.next`, etc.), lockfiles, IDE folders, and similar are skipped automatically.
- **Secrets** — `.env` files, SSH and TLS private keys, cloud service-account credentials, and similar are detected and excluded before they're ever read, not just filtered by extension. The tool names exactly which files were excluded for this reason, so you can verify nothing sensitive was missed.

Both are on by default and can't be disabled — the same design decision the web app makes.

## Supported file types

Source code, Markdown, JSON/YAML/TOML/config files, and plain text are read and included in full.

PDF, DOCX, and XLSX are **not** parsed by this tool — a deliberate scope decision. Supporting them would pull in dependencies that roughly quintuple the install size for a capability rarely relevant to "help me work on this codebase" sessions. Files of these types still appear in the directory tree so Claude knows they exist; they're just marked `[Binary file — content not extracted]` instead of read. For projects where those formats matter, use the [web app](https://www.repoprep.com) — it's the only repoprep surface that supports them; the [Chrome extension](https://chromewebstore.google.com/detail/repoprep/ocafmohghoihkdmmedcddpbggengjonc) is scoped to source and text files too, same as this tool.

## FAQ

**Does my code ever get uploaded anywhere?**
No. Files are read from disk and passed directly to Claude in the same local process — that never touches the network, on any tier. The only network activity this tool ever performs is license-related: one request to activate Pro, and an occasional background check after that (see [Activating Pro](#activating-pro)).

**Do I have to type my license key into an AI chat?**
No. Run `npx repoprep-mcp activate` in your terminal instead — same activation, same cached result, no AI client involved at any point. See [Activating Pro](#activating-pro).

**Why does Pro cap out at 200 files instead of being unlimited?**
Even locally, a single MCP call returning an unbounded amount of text isn't useful — Claude has its own context limits, and a cap keeps responses focused and fast. 200 files / 20 MB comfortably covers real-world projects while staying well within what's practical to hand to a model in one go.

**Can I use this without buying Pro?**
Yes — `get_codebase_context` works immediately with no setup, at the free tier's limits.

**I have Pro on the web app already — do I need to buy it again?**
No. Run `repoprep_activate_pro` (or `npx repoprep-mcp activate`) with the same email and license key from your original purchase.

**How do I switch a machine back to the free tier?**
Run `repoprep_deactivate_pro` in chat, or `npx repoprep-mcp logout` in your terminal. Your license is unaffected — reactivate any time.

**It says "not a directory" or can't find my path — what's wrong?**
Relative paths are resolved against the folder the MCP server process starts in, which is rarely where your project actually lives. Give Claude the full, absolute path (e.g. `C:\Users\you\Projects\app` or `/Users/you/projects/app`).

## Development

```bash
git clone https://github.com/Kishoren1/repoprep-mcp.git
cd repoprep-mcp
npm install
npm run dev     # runs directly from source via tsx, no build step
npm run build   # compiles to dist/, what actually gets published
```

Before publishing, `npx repoprep-mcp activate` and `npx repoprep-mcp logout` won't resolve yet (the package isn't on the registry). Test them locally against your own build instead:

```bash
node dist/index.js activate
node dist/index.js logout
```

## Related

- [repoprep.com](https://www.repoprep.com) — the web app
- [Chrome extension](https://chromewebstore.google.com/detail/repoprep/ocafmohghoihkdmmedcddpbggengjonc) — for private GitHub/GitLab repos, using your existing browser session
- [Source](https://github.com/Kishoren1/repoprep-app) — the core parsing/filtering engine this tool shares with the web app

## License

MIT — see [LICENSE](./LICENSE).

## Support

Questions or issues: [repoprepcare@gmail.com](mailto:repoprepcare@gmail.com)
