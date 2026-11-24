/**
 * load-env-files.ts — fill process.env from the env files before the Stitch SDK loads.
 *
 * Imported for its side effect, first, by stitch-api-call.ts only: the quota and
 * write-output scripts must never hold the API key.
 *
 * Order, highest first: shell export, the project's `.meowkit/.env`, the pre-move
 * `.claude/.env`, then the user-wide `~/.meowkit/.env`. The first source to set a key
 * wins, and nothing already set is replaced. Lines are parsed as KEY=VALUE, never run.
 */

import fs from "fs";
import os from "os";
import path from "path";

const REFUSED_KEYS = new Set([
  "PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES",
  "DYLD_FRAMEWORK_PATH", "IFS", "BASH_ENV", "ENV",
]);

function parseEnvFile(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trimStart();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || REFUSED_KEYS.has(key) || out.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0]);
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/\s#/);
      if (comment > 0) value = value.slice(0, comment).trimEnd();
    }
    out.set(key, value);
  }
  return out;
}

/** The open project: the runtime's variable, else the nearest folder above cwd with `.meowkit/`. */
function findProjectRoot(): string {
  const fromEnv = process.env.MEOWKIT_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_DIR;
  if (fromEnv) return fromEnv;
  const home = os.homedir();
  let dir = process.cwd();
  for (let depth = 0; depth < 12; depth += 1) {
    if (dir !== home && fs.existsSync(path.join(dir, ".meowkit"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const root = findProjectRoot();
for (const file of [
  path.join(root, ".meowkit", ".env"),
  path.join(root, ".claude", ".env"),
  path.join(os.homedir(), ".meowkit", ".env"),
]) {
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [key, value] of parseEnvFile(content)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
