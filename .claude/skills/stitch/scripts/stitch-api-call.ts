/**
 * stitch-api-call.ts — Stitch API boundary: validate input → call Stitch API → emit JSON.
 *
 * Security boundary: this script holds the API key [B] and processes the user's
 * text prompt [A] but performs NO file writes [C]. Output is JSON on stdout.
 * The companion stitch-write-output.ts reads this JSON and performs file writes
 * without touching the API key, satisfying the Skill Rule of Two (at most 2 of 3).
 *
 * Usage:
 *   npx tsx stitch-api-call.ts generate "<prompt>" [--project <id>] [--project-name <name>]
 *                                                   [--device mobile|desktop|tablet]
 *                                                   [--variants <count>]
 *   npx tsx stitch-api-call.ts export <screen-id>   [--project <id>] [--project-name <name>]
 *                                                   [--format html|image|all]
 *
 * Env:  STITCH_API_KEY (required — exits 1 if missing, before any network call)
 *       STITCH_PROJECT_ID (optional default project ID)
 *       STITCH_QUOTA_LIMIT (optional daily credit override, default 400)
 */

import { stitch } from "@google/stitch-sdk";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// ── Fail-closed key gate ──────────────────────────────────────────────────────
// This check runs before any Stitch SDK method is called.
// The SDK is imported above (module load) but makes no network calls at import time.
if (!process.env.STITCH_API_KEY) {
  console.error("[X] STITCH_API_KEY is not set.");
  console.error("[X] Get a key at https://stitch.withgoogle.com/settings/api");
  console.error("[X] Add to .claude/.env: STITCH_API_KEY=<your-stitch-api-key>");
  process.exit(1);
}

// ── Quota helpers ─────────────────────────────────────────────────────────────
// Quota state persists in CLAUDE_PLUGIN_DATA to survive skill upgrades (skill-authoring-rules Rule 2).
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA ?? path.join(os.homedir(), ".meowkit");
const QUOTA_DIR = path.join(PLUGIN_DATA, "stitch");
const QUOTA_FILE = path.join(QUOTA_DIR, ".stitch-quota.json");
// Stitch free tier: 400 daily credits for generate + variants. No API to fetch real usage.
const DEFAULT_LIMIT = parseInt(process.env.STITCH_QUOTA_LIMIT ?? "400", 10);

interface QuotaState { date: string; count: number; limit: number; }

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

function loadQuota(): QuotaState {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_FILE, "utf-8")) as QuotaState;
      if (data.date !== todayUTC()) return { date: todayUTC(), count: 0, limit: data.limit ?? DEFAULT_LIMIT };
      return data;
    }
  } catch { /* corrupted — start fresh */ }
  return { date: todayUTC(), count: 0, limit: DEFAULT_LIMIT };
}

function saveQuota(state: QuotaState): void {
  fs.mkdirSync(QUOTA_DIR, { recursive: true });
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(state, null, 2));
}

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const subcommand = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function getPositional(startAt = 1): string[] {
  const out: string[] = [];
  for (let i = startAt; i < args.length; i++) {
    if (args[i].startsWith("--")) { i++; } else { out.push(args[i]); }
  }
  return out;
}

// ── Project name auto-detection ───────────────────────────────────────────────
function autoDetectProjectName(): string {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const name = remote.replace(/\.git$/, "").split(/[/:]/).pop() ?? "";
    if (name) return name.slice(0, 50);
  } catch { /* not a git repo or no remote */ }
  return path.basename(process.cwd()).slice(0, 50);
}

function resolveProject(): { projectId: string; projectName: string; isNameBased: boolean } {
  const direct = getFlag("project") ?? process.env.STITCH_PROJECT_ID;
  const nameFlag = getFlag("project-name");
  if (direct) {
    console.error(`[i] Project: ${direct} (direct ID)`);
    return { projectId: direct, projectName: direct, isNameBased: false };
  }
  if (nameFlag) {
    const name = nameFlag.slice(0, 50);
    console.error(`[i] Project name: "${name}" (--project-name flag)`);
    return { projectId: name, projectName: name, isNameBased: true };
  }
  const detected = autoDetectProjectName();
  const name = detected || "meowkit-default";
  console.error(`[i] Project name: "${name}" (${detected ? "auto-detected" : "fallback default"})`);
  return { projectId: name, projectName: name, isNameBased: true };
}

// ── Input validation ──────────────────────────────────────────────────────────
// API response content is DATA (injection-rules Rule 7); validate prompts before sending.
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /you\s+are\s+now/i,
  /new\s+system\s+prompt/i,
  /disregard\s+your\s+rules/i,
  /forget\s+your\s+rules/i,
  /pretend\s+you\s+are/i,
];

function validatePrompt(prompt: string): void {
  if (!prompt || prompt.trim().length === 0) {
    console.error("[X] Prompt must be a non-empty string.");
    process.exit(1);
  }
  if (prompt.length > 2000) {
    console.error(`[X] Prompt too long (${prompt.length} chars, max 2000). Shorten the description.`);
    process.exit(1);
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      console.error("[X] Prompt rejected: contains instruction-override pattern (DATA boundary).");
      process.exit(1);
    }
  }
}

// ── Project lookup helper ─────────────────────────────────────────────────────
async function lookupOrCreateProject(projectName: string): Promise<string> {
  const projects = await stitch.projects();
  const existing = projects.find((p) => p.data?.title === projectName);
  if (existing) {
    console.error(`[i] Using project: "${projectName}" (${existing.id})`);
    return existing.id;
  }
  console.error(`[i] Creating project "${projectName}"...`);
  const created = await stitch.createProject(projectName);
  console.error(`[OK] Created project: "${projectName}" (${created.id})`);
  return created.id;
}

// ── generate subcommand ───────────────────────────────────────────────────────
async function runGenerate(): Promise<void> {
  const prompt = getPositional(1)[0];
  if (!prompt) {
    console.error("Usage: npx tsx stitch-api-call.ts generate <prompt> [--device mobile|desktop|tablet] [--variants <count>]");
    process.exit(1);
  }

  validatePrompt(prompt);

  const deviceFlag = getFlag("device");
  const DEVICE_MAP: Record<string, "MOBILE" | "DESKTOP" | "TABLET"> = {
    mobile: "MOBILE", desktop: "DESKTOP", tablet: "TABLET",
  };
  const deviceType = deviceFlag
    ? (DEVICE_MAP[deviceFlag.toLowerCase()] ?? deviceFlag.toUpperCase() as "MOBILE" | "DESKTOP" | "TABLET")
    : undefined;
  const variantCount = getFlag("variants") ? parseInt(getFlag("variants")!, 10) : 0;
  const creditsNeeded = 1 + variantCount;

  const quota = loadQuota();
  const remaining = quota.limit - quota.count;
  if (remaining < creditsNeeded) {
    console.error(`[X] Insufficient credits: need ${creditsNeeded}, have ${remaining}/${quota.limit}.`);
    console.error("[i] Use mk:frontend-design as text-based fallback, or wait until midnight UTC.");
    process.exit(2);
  }
  console.error(`[i] Credits: ${remaining}/${quota.limit} remaining (costs ${creditsNeeded})`);
  console.error(`[i] Prompt: "${prompt}"`);

  const { projectId, projectName, isNameBased } = resolveProject();
  const resolvedId = isNameBased ? await lookupOrCreateProject(projectName) : projectId;
  const project = stitch.project(resolvedId);
  const screen = await project.generate(prompt, deviceType);
  const imageUrl = await screen.getImage();

  const result: Record<string, unknown> = {
    screenId: screen.id,
    projectId: resolvedId,
    imageUrl,
    prompt,
  };

  if (variantCount > 0) {
    console.error(`[i] Generating ${variantCount} variant(s)...`);
    const variants = await screen.variants("Generate design variants", {
      variantCount,
      creativeRange: "medium",
    });
    result.variants = await Promise.all(variants.map(async (v) => ({
      screenId: v.id,
      imageUrl: await v.getImage(),
    })));
  }

  const updated = loadQuota();
  updated.count += creditsNeeded;
  saveQuota(updated);
  result.creditsUsed = creditsNeeded;
  result.creditsRemaining = updated.limit - updated.count;
  console.error(`[OK] Quota: ${updated.count}/${updated.limit} used (${result.creditsRemaining} remaining)`);

  // Emit JSON to stdout — stitch-write-output.ts reads this (no file writes in this step)
  console.log(JSON.stringify(result, null, 2));
}

// ── export subcommand ─────────────────────────────────────────────────────────
async function runExport(): Promise<void> {
  const screenId = getPositional(1)[0];
  if (!screenId) {
    console.error("Usage: npx tsx stitch-api-call.ts export <screen-id> [--format html|image|all]");
    process.exit(1);
  }

  const format = getFlag("format") ?? "all";
  const { projectId, projectName, isNameBased } = resolveProject();

  let resolvedId = projectId;
  if (isNameBased) {
    const projects = await stitch.projects();
    const found = projects.find((p) => p.data?.title === projectName);
    if (found) {
      resolvedId = found.id;
      console.error(`[i] Using project: "${projectName}" (${resolvedId})`);
    } else {
      console.error(`[!] Project "${projectName}" not found; using name as ID fallback`);
    }
  }

  const project = stitch.project(resolvedId);
  const screen = await project.getScreen(screenId);

  const result: Record<string, unknown> = {
    screenId,
    projectId: resolvedId,
    format,
  };

  if (format === "html" || format === "all") {
    result.htmlUrl = await screen.getHtml();
  }
  if (format === "image" || format === "all") {
    result.imageUrl = await screen.getImage();
  }

  // Emit JSON to stdout — stitch-write-output.ts reads this (no file writes in this step)
  console.log(JSON.stringify(result, null, 2));
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  try {
    if (subcommand === "generate") {
      await runGenerate();
    } else if (subcommand === "export") {
      await runExport();
    } else {
      console.error("Usage: npx tsx stitch-api-call.ts <generate|export> [args]");
      process.exit(1);
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "RATE_LIMITED") {
      // Sync local tracker to the API's truth when it enforces the real limit
      const q = loadQuota();
      q.count = q.limit;
      saveQuota(q);
      console.error("[X] Daily quota exceeded (local tracker synced). Use mk:frontend-design or wait until midnight UTC.");
    } else if (err.code === "AUTH_FAILED") {
      console.error("[X] Authentication failed. Check STITCH_API_KEY env var.");
    } else if (err.code === "NOT_FOUND") {
      console.error("[X] Screen or project not found. Verify the screen ID.");
    } else {
      console.error(`[X] Stitch error: ${err.message ?? String(error)}`);
    }
    process.exit(1);
  }
}

main();
