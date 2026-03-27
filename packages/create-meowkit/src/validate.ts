import { existsSync, readdirSync, statSync, accessSync, constants } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function check(
  label: string,
  pass: boolean,
  issues: string[]
): boolean {
  if (pass) {
    console.log(`  ${pc.green("PASS")} ${label}`);
  } else {
    console.log(`  ${pc.red("FAIL")} ${label}`);
    issues.push(label);
  }
  return pass;
}

/** Counts .md files in a directory (non-recursive) */
function countMdFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

/** Counts subdirectories in a directory */
function countSubdirs(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => {
      try {
        return statSync(join(dir, f)).isDirectory();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}

export function validate(targetDir: string): ValidationResult {
  const issues: string[] = [];
  const claude = join(targetDir, ".claude");

  console.log(pc.bold("\nValidation Results:"));

  // Core structure
  check(".claude/ directory exists", existsSync(claude), issues);
  check("CLAUDE.md exists", existsSync(join(targetDir, "CLAUDE.md")), issues);
  check(
    ".meowkit.config.json exists",
    existsSync(join(targetDir, ".meowkit.config.json")),
    issues
  );

  // Agents (expect 10+ from real system)
  const agentCount = countMdFiles(join(claude, "agents"));
  check(
    `Agents: ${agentCount} files (need 10+)`,
    agentCount >= 10,
    issues
  );

  // Skills (expect 30+ directories)
  const skillCount = countSubdirs(join(claude, "skills"));
  check(
    `Skills: ${skillCount} directories (need 30+)`,
    skillCount >= 30,
    issues
  );

  // Commands
  const cmdDir = join(claude, "commands");
  const cmdExists = existsSync(cmdDir);
  check("Commands directory exists", cmdExists, issues);

  // Modes
  const modeCount = countMdFiles(join(claude, "modes"));
  check(
    `Modes: ${modeCount} files (need 5+)`,
    modeCount >= 5,
    issues
  );

  // Rules
  const ruleCount = countMdFiles(join(claude, "rules"));
  check(
    `Rules: ${ruleCount} files (need 10+)`,
    ruleCount >= 10,
    issues
  );

  // Hooks — all must be executable
  const hooksDir = join(claude, "hooks");
  if (existsSync(hooksDir)) {
    const hookFiles = readdirSync(hooksDir);
    for (const hookFile of hookFiles) {
      const hookPath = join(hooksDir, hookFile);
      let isExecutable = false;
      try {
        accessSync(hookPath, constants.X_OK);
        isExecutable = true;
      } catch {
        // Not executable
      }
      check(`Hook ${hookFile} is executable`, isExecutable, issues);
    }
  } else {
    check("Hooks directory exists", false, issues);
  }

  // Scripts
  check(
    "Scripts directory exists",
    existsSync(join(claude, "scripts")),
    issues
  );

  // Settings
  check(
    "settings.json exists",
    existsSync(join(claude, "settings.json")),
    issues
  );

  const valid = issues.length === 0;
  console.log(
    valid
      ? `\n  ${pc.green(pc.bold("All checks passed"))}`
      : `\n  ${pc.red(pc.bold(`${issues.length} issue(s) found`))}`
  );

  return { valid, issues };
}
