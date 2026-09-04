export const MAX_RESPONSE_BYTES = 900_000;

export function measureResponseBytes(text: string): number {
  const payload = JSON.stringify({
    content: [{ type: "text", text }],
  });
  return Buffer.byteLength(payload, "utf-8");
}
