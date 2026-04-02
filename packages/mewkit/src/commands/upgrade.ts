import fs from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import {
  fetchReleases,
  downloadRelease,
  cleanupDownload,
  smartUpdate,
} from "../core/index.js";
import type { ReleaseInfo, UserConfig } from "../core/index.js";

export interface UpgradeArgs {
  check?: boolean;
  beta?: boolean;
  list?: boolean;
}

/** Read installed version from .claude/metadata.json (instant, no npx) */
function getLocalVersion(): string | null {
  try {
    const raw = fs.readFileSync(join(process.cwd(), ".claude", "metadata.json"), "utf-8");
    const meta = JSON.parse(raw) as { version?: string };
    return meta.version ?? null;
  } catch {
    return null;
  }
}

/** Format a date string as YYYY-MM-DD */
function formatDate(iso: string): string {
  return iso.split("T")[0];
}

/** Show available releases fetched from GitHub */
async function listReleases(localVersion: string | null): Promise<void> {
  console.log(pc.dim("Fetching available releases from GitHub..."));

  const releases = await fetchReleases();

  const stable = releases.filter((r) => !r.isBeta);
  const beta = releases.filter((r) => r.isBeta);

  console.log();
  console.log(pc.bold("Channels:"));
  console.log(`  ${pc.green("stable:")}  ${stable[0]?.version ?? "none"}`);
  if (beta.length > 0) {
    console.log(`  ${pc.yellow("beta:")}    ${beta[0]?.version ?? "none"}`);
  }

  console.log();
  console.log(pc.bold("Recent releases:"));
  for (const r of releases.slice(0, 10)) {
    const installed = r.version === localVersion ? pc.cyan(" (installed)") : "";
    const label = r.isBeta ? pc.yellow(" (beta)") : "";
    console.log(`  ${r.version}${label}${installed}  ${pc.dim(formatDate(r.publishedAt))}`);
  }
}

/** Compare local vs latest GitHub release */
async function checkVersion(localVersion: string | null, useBeta: boolean): Promise<void> {
  console.log(pc.dim("Checking for updates..."));

  const releases = await fetchReleases();
  const latestStable = releases.find((r) => !r.isBeta);
  const latestBeta = releases.find((r) => r.isBeta);

  console.log(`${pc.bold("Local version:")}   ${localVersion ? pc.cyan(localVersion) : pc.dim("not installed")}`);
  if (latestStable) {
    console.log(`${pc.bold("Latest stable:")}   ${pc.green(latestStable.version)}  ${pc.dim(formatDate(latestStable.publishedAt))}`);
  }
  if (latestBeta) {
    console.log(`${pc.bold("Latest beta:")}     ${pc.yellow(latestBeta.version)}  ${pc.dim(formatDate(latestBeta.publishedAt))}`);
  }

  const compareTo = useBeta ? (latestBeta ?? latestStable) : latestStable;
  if (!compareTo) {
    console.log(pc.yellow("No releases found on GitHub."));
    return;
  }

  if (localVersion === compareTo.version) {
    console.log(pc.green("\nAlready up to date."));
  } else {
    console.log(pc.yellow(`\nUpdate available: ${localVersion ?? "none"} → ${compareTo.version}`));
    console.log(pc.dim("Run `npx mewkit upgrade` to install."));
  }
}

/** Perform the upgrade: download latest release and apply via smart update */
async function performUpgrade(localVersion: string | null, useBeta: boolean): Promise<void> {
  console.log(pc.dim("Fetching latest release from GitHub..."));

  const releases = await fetchReleases();
  const latest: ReleaseInfo | undefined = useBeta
    ? (releases.find((r) => r.isBeta) ?? releases.find((r) => !r.isBeta))
    : releases.find((r) => !r.isBeta);

  if (!latest) {
    console.error(pc.red("No releases found on GitHub."));
    process.exit(1);
  }

  if (localVersion === latest.version) {
    console.log(pc.green(`Already up to date (v${latest.version}).`));
    return;
  }

  console.log(`Upgrading: ${pc.dim(localVersion ?? "none")} → ${pc.cyan(latest.version)}`);
  console.log(pc.dim(`Downloading v${latest.version}...`));

  let sourceDir: string;
  try {
    sourceDir = await downloadRelease(latest);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`Download failed: ${msg}`));
    process.exit(1);
  }

  try {
    const config: UserConfig = {
      description: "",
      enableCostTracking: true,
      enableMemory: true,
      geminiApiKey: null,
    };

    const stats = await smartUpdate(config, sourceDir, process.cwd(), /* dryRun */ false, /* force */ false);

    console.log();
    console.log(pc.green(pc.bold("Upgrade complete!")));
    console.log(`  ${pc.dim("Before:")} ${localVersion ?? "not installed"}`);
    console.log(`  ${pc.dim("After:")}  ${latest.version}`);
    console.log();
    console.log(`  ${pc.green("added")}   ${stats.added}`);
    console.log(`  ${pc.cyan("updated")} ${stats.updated}`);
    console.log(`  ${pc.dim("skipped")} ${stats.skipped}`);

    if (stats.userModified.length > 0) {
      console.log(pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved (use --force to overwrite).`));
    }
  } finally {
    cleanupDownload(sourceDir);
  }
}

export async function upgrade(args: UpgradeArgs): Promise<void> {
  const localVersion = getLocalVersion();
  const useBeta = args.beta ?? false;

  if (localVersion) {
    const isBeta = localVersion.includes("-beta") || localVersion.includes("-rc");
    console.log(
      `${pc.bold("Current version:")} ${pc.cyan(localVersion)}${isBeta ? pc.dim(" (beta)") : ""}`
    );
  } else {
    console.log(`${pc.bold("Current version:")} ${pc.dim("not installed")}`);
  }

  try {
    if (args.list) {
      await listReleases(localVersion);
      return;
    }

    if (args.check) {
      await checkVersion(localVersion, useBeta);
      return;
    }

    await performUpgrade(localVersion, useBeta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`upgrade failed: ${msg}`));
    process.exit(1);
  }
}
