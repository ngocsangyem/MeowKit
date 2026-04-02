import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** File layer determines update behavior */
export type FileLayer = "core" | "skill" | "user";

export interface ManifestEntry {
  sha256: string;
  layer: FileLayer;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  checksums: Record<string, ManifestEntry>;
}

const MANIFEST_FILENAME = "meowkit.manifest.json";

/** Directories classified as "core" — overwritten on update if unchanged */
const CORE_DIRS = new Set(["agents", "commands", "hooks", "modes", "rules", "scripts"]);

/** Files classified as "user" — never overwritten */
const USER_FILES = new Set([
  "CLAUDE.md",
  "meowkit.config.json",
  ".env",
  "env.example",
  "mcp.json.example",
  "mcp.json",
  "gitignore.meowkit",
  "meowkit.manifest.json",
]);

/** Directories classified as "user" — never overwritten */
const USER_DIRS = new Set(["memory", "logs"]);

/** Compute SHA-256 hash of a file */
export function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/** Determine the layer of a file based on its path relative to the project root */
export function classifyLayer(relativePath: string): FileLayer {
  // User-level files at project root
  const basename = relativePath.split("/").pop() ?? "";
  if (USER_FILES.has(basename) || USER_FILES.has(relativePath)) return "user";

  // Check path segments for directory-based classification
  const parts = relativePath.split("/");
  const topDir = parts[0];

  if (USER_DIRS.has(topDir)) return "user";
  if (topDir === "skills") return "skill";
  if (CORE_DIRS.has(topDir)) return "core";
  if (topDir === "settings.json") return "core";

  return "user";
}

/**
 * Recursively collect all files in a directory, returning paths relative to baseDir.
 * Skips __pycache__, node_modules, .DS_Store, .meowkit.manifest.json.
 */
function collectFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const SKIP = new Set(["__pycache__", "node_modules", ".DS_Store", MANIFEST_FILENAME]);

  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

/**
 * Build a manifest by scanning all files in the .claude/ directory.
 * All MeowKit files live inside .claude/ — no root-level scanning.
 */
export function buildManifest(claudeDir: string): Manifest {
  const checksums: Record<string, ManifestEntry> = {};

  const files = collectFiles(claudeDir, claudeDir);

  for (const relPath of files) {
    const fullPath = join(claudeDir, relPath);
    checksums[relPath] = {
      sha256: hashFile(fullPath),
      layer: classifyLayer(relPath),
    };
  }

  return {
    version: "0.1.0",
    generatedAt: new Date().toISOString(),
    checksums,
  };
}

/** Write manifest to disk */
export function writeManifest(targetDir: string, manifest: Manifest): void {
  const path = join(targetDir, MANIFEST_FILENAME);
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

/** Read existing manifest from disk. Returns null if not found or invalid. */
export function readManifest(targetDir: string): Manifest | null {
  const path = join(targetDir, MANIFEST_FILENAME);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch {
    return null;
  }
}
