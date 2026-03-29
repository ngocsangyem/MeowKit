import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");

/**
 * Tests that the release zip (built by prepare-release-assets.cjs)
 * contains the correct files from the top-level .claude/ and tasks/.
 *
 * This validates the source-of-truth: top-level .claude/ is what gets released.
 */
describe("release asset structure", () => {
  it("should have .claude/ at repo root with core directories", () => {
    const claudeDir = join(REPO_ROOT, ".claude");
    expect(existsSync(claudeDir)).toBe(true);

    const coreDirs = ["agents", "commands", "hooks", "modes", "rules", "scripts", "skills"];
    for (const dir of coreDirs) {
      expect(existsSync(join(claudeDir, dir))).toBe(true);
    }
  });

  it("should have static config files inside .claude/", () => {
    expect(existsSync(join(REPO_ROOT, ".claude", "env.example"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, ".claude", "mcp.json.example"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, ".claude", "gitignore.meowkit"))).toBe(true);
  });

  it("should NOT have static files at repo root", () => {
    expect(existsSync(join(REPO_ROOT, "env.example"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "mcp.json.example"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "gitignore.meowkit"))).toBe(false);
  });

  it("should have settings.json in .claude/", () => {
    expect(existsSync(join(REPO_ROOT, ".claude", "settings.json"))).toBe(true);
  });

  it("should have CLAUDE.md at repo root", () => {
    expect(existsSync(join(REPO_ROOT, "CLAUDE.md"))).toBe(true);
  });

  it("should have tasks/templates/ at repo root", () => {
    const tasksDir = join(REPO_ROOT, "tasks", "templates");
    expect(existsSync(tasksDir)).toBe(true);
    const files = readdirSync(tasksDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should NOT have templates/ in create-meowkit package (no bundling)", () => {
    const pkgDir = resolve(__dirname, "..", "..");
    const templatesDir = join(pkgDir, "templates");
    // templates/ should not exist or be empty (it's a build artifact, gitignored)
    if (existsSync(templatesDir)) {
      // If it exists from a previous build, that's OK but it shouldn't be in package.json files
      const pkgJson = JSON.parse(
        require("node:fs").readFileSync(join(pkgDir, "package.json"), "utf-8")
      );
      expect(pkgJson.files).not.toContain("templates");
    }
  });

  it("should have at least 400 files in .claude/", () => {
    function countFiles(dir: string): number {
      let count = 0;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "__pycache__" || entry.name === ".DS_Store") continue;
        if (entry.name === "memory" || entry.name === "logs") continue; // runtime dirs
        const full = join(dir, entry.name);
        if (entry.isDirectory()) count += countFiles(full);
        else count++;
      }
      return count;
    }

    const total = countFiles(join(REPO_ROOT, ".claude"));
    expect(total).toBeGreaterThanOrEqual(400);
  });
});
