import {
  readStoredToken,
  writeStoredToken,
  clearStoredToken,
  type StoredToken,
} from "./store.js";

const API_BASE = process.env.REPOPREP_API_BASE ?? "https://www.repoprep.com";
const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface TokenPayload {
  email: string;
  iat: number;
  exp: number;
}

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const payloadPart = token.split(".")[0];
    const json = Buffer.from(payloadPart, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as TokenPayload;
    if (!parsed.email || !parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface ActivateResult {
  ok: boolean;
  message: string;
  email?: string;
}

export async function activateLicense(
  email: string,
  licenseKey: string,
): Promise<ActivateResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/verify-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, licenseKey }),
    });
  } catch {
    return {
      ok: false,
      message:
        "Couldn't reach repoprep.com to verify the license. Check your internet connection and try again.",
    };
  }

  let data: { valid: boolean; message?: string; token?: string };
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      message: `Unexpected response from repoprep.com (HTTP ${res.status}). Please try again.`,
    };
  }

  if (!data.valid || !data.token) {
    return {
      ok: false,
      message:
        data.message ??
        "License verification failed. Please check your email and license key.",
    };
  }

  const payload = decodeTokenPayload(data.token);
  const resolvedEmail = payload?.email ?? email.trim().toLowerCase();

  const stored: StoredToken = {
    token: data.token,
    email: resolvedEmail,
    cachedAt: Date.now(),
  };
  await writeStoredToken(stored);

  return {
    ok: true,
    message: "Pro activated. Limits are now 200 files / 20 MB.",
    email: resolvedEmail,
  };
}

export interface DeactivateResult {
  ok: boolean;
  message: string;
}

export async function deactivateLicense(): Promise<DeactivateResult> {
  const stored = await readStoredToken();
  if (!stored) {
    return {
      ok: true,
      message:
        "No active Pro license found on this machine — already at the free tier (50 files / 4 MB).",
    };
  }

  await clearStoredToken();

  return {
    ok: true,
    message: `Pro license for ${stored.email} deactivated on this machine. Limits are now 50 files / 4 MB. Run repoprep_activate_pro (or "npx repoprep-mcp activate" in a terminal) any time to reactivate — your license itself is unaffected.`,
  };
}

export interface TierResult {
  isPro: boolean;
  email: string | null;
}

export async function getEffectiveTier(): Promise<TierResult> {
  const stored = await readStoredToken();
  if (!stored) return { isPro: false, email: null };

  const payload = decodeTokenPayload(stored.token);
  if (!payload || Date.now() > payload.exp) {
    await clearStoredToken();
    return { isPro: false, email: null };
  }

  if (Date.now() - stored.cachedAt > REVALIDATE_INTERVAL_MS) {
    void revalidateInBackground(stored);
  }

  return { isPro: true, email: payload.email };
}

async function revalidateInBackground(stored: StoredToken): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: stored.token }),
    });
    if (!res.ok) return;

    const data = (await res.json()) as { valid: boolean; email?: string };

    if (data.valid) {
      await writeStoredToken({
        ...stored,
        cachedAt: Date.now(),
        email: data.email ?? stored.email,
      });
    } else {
      await clearStoredToken();
    }
  } catch {
    // Revalidation hiccup — non-fatal. We keep trusting the cached token
    // until the next scheduled check or its natural expiry.
  }
}
