import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { smartUpdate } from "../smart-update.js";
import type { UserConfig } from "../prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const TEST_DIR = join(tmpdir(), "meowkit-test-" + Date.now());

// sourceDir = repo root (contains .claude/, tasks/, CLAUDE.md)
// This simulates what a downloaded+extracted release looks like
const SOURCE_DIR = REPO_ROOT;

const defaultConfig: UserConfig = {
  description: "Test project",
  enableCostTracking: true,
  enableMemory: true,
  geminiApiKey: null,
};

describe("smartUpdate (GitHub-download model)", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should create .claude/ directory structure from source", async () => {
    const stats = await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    expect(existsSync(join(TEST_DIR, ".claude"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "agents"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "skills"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "rules"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "hooks"))).toBe(true);
    expect(stats.added).toBeGreaterThan(0);
  });

  it("should copy static files into .claude/ from source", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    expect(existsSync(join(TEST_DIR, ".claude", "env.example"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "mcp.json.example"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".claude", "gitignore.meowkit"))).toBe(true);
  });

  it("should NOT place static files at project root", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    expect(existsSync(join(TEST_DIR, "env.example"))).toBe(false);
    expect(existsSync(join(TEST_DIR, "mcp.json.example"))).toBe(false);
    expect(existsSync(join(TEST_DIR, "gitignore.meowkit"))).toBe(false);
  });

  it("should create CLAUDE.md at project root", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    expect(existsSync(join(TEST_DIR, "CLAUDE.md"))).toBe(true);
  });

  it("should create tasks/ directory", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    expect(existsSync(join(TEST_DIR, "tasks"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "tasks", "templates"))).toBe(true);
  });

  it("should create meowkit.config.json in .claude/", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    const configPath = join(TEST_DIR, ".claude", "meowkit.config.json");
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("Test project");
  });

  it("should create manifest after installation", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    const manifestPath = join(TEST_DIR, ".claude", "meowkit.manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest).toHaveProperty("checksums");
  });

  it("should not overwrite user-modified files on re-run", async () => {
    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    const rulesPath = join(TEST_DIR, ".claude", "rules", "security-rules.md");
    expect(existsSync(rulesPath)).toBe(true);
    writeFileSync(rulesPath, "# My custom security rules\n", "utf-8");

    await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, false);

    const content = readFileSync(rulesPath, "utf-8");
    expect(content).toBe("# My custom security rules\n");
  });

  it("should respect dry-run mode", async () => {
    const stats = await smartUpdate(defaultConfig, SOURCE_DIR, TEST_DIR, true);

    expect(existsSync(join(TEST_DIR, ".claude"))).toBe(false);
    expect(stats.added).toBeGreaterThan(0);
  });

  it("should write .env when geminiApiKey is provided", async () => {
    const configWithKey: UserConfig = {
      ...defaultConfig,
      geminiApiKey: "test-key-123",
    };

    await smartUpdate(configWithKey, SOURCE_DIR, TEST_DIR, false);

    const envPath = join(TEST_DIR, ".claude", ".env");
    expect(existsSync(envPath)).toBe(true);
    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("GEMINI_API_KEY=test-key-123");
  });
});
