/**
 * Semantic Release Configuration for MeowKit monorepo.
 *
 * Branch routing:
 * - main → production release (v1.2.0, npm @latest)
 * - dev  → beta release (v1.3.0-beta.1, npm @beta)
 *
 * Publishes mewkit package and creates GitHub Release with zip asset.
 */

const { execSync } = require("child_process");

// Detect current branch from CI or local git
const currentBranch =
  process.env.GITHUB_REF_NAME ||
  process.env.GIT_BRANCH ||
  (() => {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    } catch {
      return "main";
    }
  })();

const isBeta = currentBranch === "dev";
const npmTag = isBeta ? "beta" : "latest";

console.error(`[semantic-release] Branch: ${currentBranch}, mode: ${isBeta ? "BETA" : "PRODUCTION"}`);

module.exports = {
  branches: isBeta
    ? ["main", { name: "dev", prerelease: "beta" }]
    : ["main"],
  plugins: [
    // 1. Analyze commits to determine version bump
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "hotfix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "refactor", release: "patch" },
        ],
      },
    ],

    // 2. Generate release notes
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Bug Fixes" },
            { type: "hotfix", section: "Hotfixes" },
            { type: "refactor", section: "Refactoring" },
            { type: "perf", section: "Performance" },
            { type: "docs", section: "Documentation" },
            { type: "test", section: "Tests" },
          ],
        },
      },
    ],

    // 3. Update CHANGELOG.md
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],

    // 4. Update package.json version (root, no publish)
    ["@semantic-release/npm", { npmPublish: false }],

    // 5. Sync versions, prepare release assets (zip is primary artifact)
    [
      "@semantic-release/exec",
      {
        prepareCmd: [
          'node scripts/sync-package-versions.cjs "${nextRelease.version}"',
          "npm run build",
          'node scripts/prepare-release-assets.cjs "${nextRelease.version}"',
        ].join(" && "),
      },
    ],

    // 6. Create GitHub Release with assets
    [
      "@semantic-release/github",
      {
        assets: [
          { path: "CHANGELOG.md", label: "Changelog" },
          { path: "dist/meowkit-release.zip", label: "MeowKit Release Package" },
        ],
        ...(isBeta ? { prerelease: true } : {}),
      },
    ],

    // 7. Commit version files back to repo
    [
      "@semantic-release/git",
      {
        assets: [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
          ".claude/metadata.json",
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
