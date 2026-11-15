// Types for the release-asset check, so the TypeScript test that imports the script itself
// (not a copy of its rules) type-checks under strict mode.

/** Problems found in `distDir` for release `version`; an empty array means the assets are complete. */
export function verifyReleaseAssets(version: string, distDir: string): string[];
