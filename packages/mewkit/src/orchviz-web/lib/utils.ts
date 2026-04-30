/** Convert a 0–1 alpha value to a two-character hex string (e.g. 0.5 → '80') */
export function alphaHex(alpha: number): string {
  return Math.floor(alpha * 255).toString(16).padStart(2, '0')
}

/** Format a token count for display (e.g. 128500 → '128k') */
export function formatTokens(tokens: number): string {
  return `${Math.floor(tokens / 1000)}k`
}

/** Truncate a file path to the last N segments (e.g. '/a/b/c/d.ts' → 'b/c/d.ts') */
export function truncatePath(path: string, segments = 3): string {
  return path.split('/').slice(-segments).join('/')
}
