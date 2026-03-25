import { existsSync, readdirSync, accessSync, constants } from "node:fs";
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

export function validate(targetDir: string): ValidationResult {
  const issues: string[] = [];
  const meowkitDir = join(targetDir, ".claude");

  console.log(pc.bold("\nValidation Results:"));

  // Check .claude/ directory exists
  check(
    ".claude/ directory exists",
    existsSync(meowkitDir),
    issues
  );

  // Check CLAUDE.md exists
  check(
    "CLAUDE.md exists",
    existsSync(join(targetDir, "CLAUDE.md")),
    issues
  );

  // Check .meowkit.config.json exists
  check(
    ".meowkit.config.json exists",
    existsSync(join(targetDir, ".meowkit.config.json")),
    issues
  );

  // Check at least 5 agent files exist
  const agentsDir = join(meowkitDir, "agents");
  let agentCount = 0;
  if (existsSync(agentsDir)) {
    try {
      const agentFiles = readdirSync(agentsDir).filter((f) =>
        f.endsWith(".md")
      );
      agentCount = agentFiles.length;
    } catch {
      // Directory read failed
    }
  }
  check(
    `At least 5 agent files in .claude/agents/ (found ${agentCount})`,
    agentCount >= 5,
    issues
  );

  // Check hooks are executable
  const hooksDir = join(meowkitDir, "hooks");
  if (existsSync(hooksDir)) {
    try {
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
        check(
          `Hook ${hookFile} is executable`,
          isExecutable,
          issues
        );
      }
    } catch {
      issues.push("Could not read hooks directory");
      console.log(`  ${pc.red("FAIL")} Could not read hooks directory`);
    }
  } else {
    check("Hooks directory exists", false, issues);
  }

  const valid = issues.length === 0;

  console.log(
    valid
      ? `\n  ${pc.green(pc.bold("All checks passed"))}`
      : `\n  ${pc.red(pc.bold(`${issues.length} issue(s) found`))}`
  );

  return { valid, issues };
}
