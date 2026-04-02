import fs from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  fetchReleases,
  downloadRelease,
  cleanupDownload,
  smartUpdate,
  validate,
} from "../core/index.js";
import type { ReleaseInfo, UserConfig } from "../core/index.js";

export interface InitArgs {
  dryRun?: boolean;
  force?: boolean;
  beta?: boolean;
}

/** Detect if this is a fresh install or an update */
function detectMode(targetDir: string): "new" | "update" {
  return fs.existsSync(join(targetDir, ".claude")) ? "update" : "new";
}

/** Build @clack/prompts options from release list */
function buildReleaseOptions(releases: ReleaseInfo[], beta: boolean) {
  const latestStable = releases.find((r) => !r.isBeta);
  const pool = beta ? releases : releases.filter((r) => !r.isBeta);
  return pool.slice(0, 10).map((r) => ({
    value: r.tag,
    label: `${r.version}${r.isBeta ? pc.yellow(" (beta)") : ""}${r.tag === latestStable?.tag ? pc.green(" (latest)") : ""}`,
    hint: r.publishedAt.split("T")[0],
  }));
}

/** Cancel-safe wrapper: exits on Ctrl+C */
function cancelCheck(value: unknown): void {
  if (p.isCancel(value)) { p.cancel("Installation cancelled."); process.exit(0); }
}

/** Prompt the user for project description + optional Gemini API key */
async function promptNewInstall(): Promise<UserConfig> {
  const description = await p.text({
    message: "Describe your project (optional)",
    placeholder: "Press Enter to skip",
    validate() { return undefined; },
  });
  cancelCheck(description);

  const addGeminiKey = await p.confirm({
    message: "Add Gemini API key? (for image/video/audio analysis)",
    initialValue: false,
  });
  cancelCheck(addGeminiKey);

  let geminiApiKey: string | null = null;
  if (addGeminiKey) {
    const keyInput = await p.text({
      message: "Enter your Gemini API key",
      placeholder: "Get one at aistudio.google.com/apikey",
      validate(value: string) {
        if (!value || value.trim().length === 0) return "API key is required";
        if (value.trim().length < 10) return "Key too short — check aistudio.google.com/apikey";
        return undefined;
      },
    });
    cancelCheck(keyInput);
    geminiApiKey = typeof keyInput === "string" ? keyInput.trim() : null;
    if (geminiApiKey) p.log.success("Gemini API key will be saved to .claude/.env");
  }

  return {
    description: typeof description === "string" ? description.trim() : "",
    enableCostTracking: true,
    enableMemory: true,
    geminiApiKey,
  };
}

/** Print install/update summary */
function printSummary(stats: { updated: number; added: number; skipped: number; userModified: string[] }, dryRun: boolean): void {
  console.log(`\n${pc.bold("Summary:")}`);
  if (stats.added > 0)   console.log(`  ${pc.green("added")}     ${stats.added}`);
  if (stats.updated > 0) console.log(`  ${pc.cyan("updated")}   ${stats.updated}`);
  if (stats.skipped > 0) console.log(`  ${pc.dim("skipped")}   ${stats.skipped}`);
  if (stats.userModified.length > 0) {
    console.log(pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved:`));
    stats.userModified.slice(0, 8).forEach((f) => console.log(`    ${pc.dim(f)}`));
    if (stats.userModified.length > 8) console.log(`    ${pc.dim(`...and ${stats.userModified.length - 8} more`)}`);
  }
  if (!dryRun) {
    console.log(`\n${pc.bold("Next steps:")}`);
    console.log(`  ${pc.dim("1.")} Run ${pc.bold("npx mewkit setup")} for guided configuration`);
    console.log(`  ${pc.dim("2.")} Run ${pc.bold("npx mewkit doctor")} to verify your environment`);
  }
}

export async function init(args: InitArgs): Promise<void> {
  const targetDir = process.cwd();
  const mode = detectMode(targetDir);
  const dryRun = args.dryRun ?? false;
  const force = args.force ?? false;

  p.intro(pc.bgCyan(pc.black(" meowkit init ")));

  if (dryRun) p.log.warn("Dry-run mode — no files will be written.");
  if (mode === "update") p.log.info("Existing .claude/ detected — running in update mode.");

  // Step 1: Fetch releases
  const releaseSpinner = p.spinner();
  releaseSpinner.start("Fetching available releases...");

  let releases: ReleaseInfo[];
  try {
    releases = await fetchReleases();
  } catch (err: unknown) {
    releaseSpinner.stop("Failed to fetch releases");
    const msg = err instanceof Error ? err.message : String(err);
    p.cancel(`Cannot fetch releases from GitHub: ${msg}`);
    process.exit(1);
  }

  if (releases.length === 0) {
    releaseSpinner.stop("No releases found");
    p.cancel("No releases available on GitHub.");
    process.exit(1);
  }

  releaseSpinner.stop(`Found ${releases.length} release(s)`);

  // Step 2: Version picker
  const options = buildReleaseOptions(releases, args.beta ?? false);
  const latestStable = releases.find((r) => !r.isBeta);

  const selected = await p.select({
    message: "Select MeowKit version to install",
    options,
    initialValue: latestStable?.tag ?? releases[0].tag,
  });

  if (p.isCancel(selected)) {
    p.cancel("Installation cancelled.");
    process.exit(0);
  }

  const release = releases.find((r) => r.tag === (selected as string))!;

  // Step 3: Config prompts (new installs only)
  let config: UserConfig;
  if (mode === "new") {
    config = await promptNewInstall();
  } else {
    config = { description: "", enableCostTracking: true, enableMemory: true, geminiApiKey: null };
  }

  // Step 4: Download release
  const downloadSpinner = p.spinner();
  downloadSpinner.start(`Downloading v${release.version}...`);

  let sourceDir: string;
  try {
    sourceDir = await downloadRelease(release);
  } catch (err: unknown) {
    downloadSpinner.stop("Download failed");
    const msg = err instanceof Error ? err.message : String(err);
    p.cancel(`Failed to download release: ${msg}`);
    process.exit(1);
  }

  downloadSpinner.stop(`Downloaded v${release.version}`);

  try {
    // Step 5: Apply via smart update
    const updateSpinner = p.spinner();
    updateSpinner.start("Applying files...");
    const stats = await smartUpdate(config, sourceDir, targetDir, dryRun, force);
    updateSpinner.stop(`Applied: ${stats.added} added, ${stats.updated} updated, ${stats.skipped} skipped`);

    // Step 6: Validate (skip dry-run)
    if (!dryRun) {
      const validateSpinner = p.spinner();
      validateSpinner.start("Validating installation...");
      const result = validate(targetDir);
      if (result.valid) {
        validateSpinner.stop("Validation passed");
      } else {
        validateSpinner.stop(`Validation: ${result.issues.length} issue(s) — run \`mewkit validate\` for details`);
      }
    }

    // Step 7: Summary
    printSummary(stats, dryRun);
    p.outro(pc.green(mode === "new" ? "MeowKit installed!" : "MeowKit updated!"));
  } finally {
    cleanupDownload(sourceDir);
  }
}
