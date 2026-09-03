const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return `~${tokens} tokens`;
  if (tokens < 1_000_000) return `~${(tokens / 1_000).toFixed(1)}k tokens`;
  return `~${(tokens / 1_000_000).toFixed(2)}M tokens`;
}
