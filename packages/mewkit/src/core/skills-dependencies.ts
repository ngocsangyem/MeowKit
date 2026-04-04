/** Skills dependency config — single source of truth for pip packages */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface SkillsDependency {
  /** pip package name (as passed to pip install) */
  name: string;
  /** Human-readable description for prompt display */
  description: string;
}

/** Default pip packages installed into .claude/skills/.venv */
export const DEFAULT_PIP_PACKAGES: readonly SkillsDependency[] = [
  { name: "google-genai", description: "Gemini API client (meow:multimodal skill)" },
  { name: "pillow", description: "Image processing (meow:multimodal)" },
  { name: "python-dotenv", description: "Env var loading (optional — scripts have fallback)" },
] as const;

/** Validate pip package name — rejects flags, URLs, shell-breaking chars */
const SAFE_PKG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(\[[a-zA-Z0-9,_-]*\])?(==|>=|<=|!=|~=|<|>)?[a-zA-Z0-9.*]*$/;

export function validatePackageName(name: string): boolean {
  if (!name || name.startsWith("-") || name.includes("://")) return false;
  const baseName = name.split(/[=<>!~]/)[0] ?? name;
  return SAFE_PKG_RE.test(baseName);
}

// Collect per-skill requirements.txt files from .claude/skills/{skill}/scripts/
function findRequirementsFiles(projectDir: string): string[] {
  const skillsDir = join(projectDir, ".claude", "skills");
  if (!existsSync(skillsDir)) return [];
  const found: string[] = [];
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const reqPath = join(skillsDir, entry.name, "scripts", "requirements.txt");
      if (existsSync(reqPath)) found.push(reqPath);
    }
  } catch { /* skills dir not readable */ }
  return found;
}

/** Parse a single requirements.txt, validating each line */
function parseRequirementsFile(filePath: string): { packages: SkillsDependency[]; rejected: string[] } {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const packages: SkillsDependency[] = [];
  const rejected: string[] = [];
  for (const line of lines) {
    if (validatePackageName(line)) {
      packages.push({ name: line, description: "" });
    } else {
      rejected.push(line);
    }
  }
  return { packages, rejected };
}

/**
 * Resolve pip packages to install.
 * Walks per-skill requirements.txt files, merges and deduplicates.
 * Falls back to DEFAULT_PIP_PACKAGES if no requirements files found.
 */
export function getRequirementsSource(projectDir: string): {
  packages: readonly SkillsDependency[];
  source: string;
  rejected: string[];
} {
  const reqFiles = findRequirementsFiles(projectDir);
  if (reqFiles.length > 0) {
    const allPackages: SkillsDependency[] = [];
    const allRejected: string[] = [];
    const seen = new Set<string>();
    for (const filePath of reqFiles) {
      const { packages, rejected } = parseRequirementsFile(filePath);
      for (const pkg of packages) {
        const baseName = (pkg.name.split(/[=<>!~]/)[0] ?? pkg.name).toLowerCase();
        if (!seen.has(baseName)) { seen.add(baseName); allPackages.push(pkg); }
      }
      allRejected.push(...rejected);
    }
    if (allRejected.length > 0) {
      console.warn(`  Skipped ${allRejected.length} invalid line(s) across ${reqFiles.length} requirements file(s)`);
    }
    if (allPackages.length > 0) {
      return { packages: allPackages, source: `${reqFiles.length} requirements.txt file(s)`, rejected: allRejected };
    }
  }
  return { packages: DEFAULT_PIP_PACKAGES, source: "built-in defaults", rejected: [] };
}

/** Format packages for CLI display */
export function formatPackageList(packages: readonly SkillsDependency[]): string {
  return packages.map((p) => {
    const desc = p.description ? ` ${p.description}` : "";
    return `  ${p.name.padEnd(18)}${desc}`;
  }).join("\n");
}
