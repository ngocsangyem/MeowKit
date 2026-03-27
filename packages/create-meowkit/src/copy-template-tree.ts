import {
  readdirSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

/** Directories/files to skip during recursive copy */
const SKIP_NAMES = new Set([
  "__pycache__",
  "node_modules",
  ".DS_Store",
  ".gitkeep",
]);

/** File extensions that should be marked executable after copy */
const EXECUTABLE_EXTENSIONS = new Set([".sh"]);

/** Hook files without extensions are also executable */
const EXECUTABLE_DIRS = new Set(["hooks"]);

/**
 * Recursively copies a directory tree from src to dest.
 * Skips __pycache__, node_modules, .DS_Store.
 * Sets executable permissions on shell scripts and hooks.
 * Returns the number of files copied.
 */
export function copyDirRecursive(
  src: string,
  dest: string,
  dryRun: boolean,
  parentDir = ""
): number {
  let count = 0;

  if (!dryRun) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    if (SKIP_NAMES.has(entry)) continue;
    if (entry.endsWith(".pyc")) continue;

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = lstatSync(srcPath);

    // Skip symlinks to avoid bundling content from outside the project
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath, dryRun, entry);
    } else {
      if (dryRun) {
        console.log(`  ${pc.dim("create")} ${destPath}`);
      } else {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);

        // Set executable: shell scripts, or files directly inside hooks/ or scripts/bin/
        const ext = entry.includes(".") ? "." + entry.split(".").pop() : "";
        const shouldBeExecutable =
          EXECUTABLE_EXTENSIONS.has(ext) ||
          EXECUTABLE_DIRS.has(parentDir) ||
          parentDir === "bin";

        if (shouldBeExecutable) {
          chmodSync(destPath, 0o755);
        }
      }
      count++;
    }
  }

  return count;
}

/**
 * Returns the path to the templates/ directory relative to the compiled dist/.
 * Works both in development (src/) and production (dist/).
 */
export function resolveTemplateDir(): string {
  // __dirname in ESM: use import.meta.url
  // But since we compile to CJS-style with Node16, use a path-based approach
  // The templates/ dir is always at the package root, sibling to dist/ and src/
  const distDir = fileURLToPath(new URL(".", import.meta.url));
  // dist/copy-template-tree.js → go up one level to package root
  const pkgRoot = join(distDir, "..");
  return join(pkgRoot, "templates");
}
