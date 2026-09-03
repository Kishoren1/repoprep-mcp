import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { activateLicense, deactivateLicense } from "./license/verify.js";

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export async function runActivateCli(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("repoprep Pro activation\n");
  console.log(
    "This runs entirely in your terminal — no AI client is involved.\n",
  );

  try {
    let email = "";
    while (!isNonEmpty(email)) {
      email = (await rl.question("Email (from your Gumroad receipt): ")).trim();
    }

    let licenseKey = "";
    while (!isNonEmpty(licenseKey)) {
      licenseKey = (
        await rl.question("License key (from your Gumroad receipt): ")
      ).trim();
    }

    console.log("\nVerifying with repoprep.com...");

    const result = await activateLicense(email, licenseKey);

    if (result.ok) {
      console.log(`\n✔ ${result.message}`);
      console.log(
        "Saved to ~/.repoprep/token.json — every MCP client on this machine will now use Pro limits automatically.",
      );
    } else {
      console.error(`\n✘ ${result.message}`);
      process.exitCode = 1;
    }
  } finally {
    rl.close();
  }
}

export async function runLogoutCli(): Promise<void> {
  const result = await deactivateLicense();
  console.log(result.message);
}
