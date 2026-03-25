import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import pc from "picocolors";
import type { UserConfig } from "./prompts.js";

function writeFile(
  filePath: string,
  content: string,
  dryRun: boolean,
  executable = false
): void {
  if (dryRun) {
    console.log(`  ${pc.dim("create")} ${filePath}`);
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");

  if (executable) {
    chmodSync(filePath, 0o755);
  }
}

function generateMeowkitMd(config: UserConfig): string {
  const modeDescriptions: Record<string, string> = {
    fast: "Minimal checks for rapid iteration. Trusts the developer to handle quality.",
    balanced:
      "Standard checks with sensible defaults. Good for most development workflows.",
    strict:
      "Thorough validation, linting, and testing. Suitable for CI and production-grade work.",
  };

  return `# CLAUDE.md

## Project: ${config.projectName}

### Stack
${config.stack.map((s) => `- ${s}`).join("\n")}

### Team
- Size: ${config.teamSize}
- Primary tool: ${config.primaryTool}

### Mode: ${config.defaultMode}
${modeDescriptions[config.defaultMode]}

### Features
- Cost tracking: ${config.enableCostTracking ? "enabled" : "disabled"}
- Memory/persistence: ${config.enableMemory ? "enabled" : "disabled"}

### Conventions
- Follow existing code style and patterns
- Write tests for new functionality
- Keep commits focused and well-described
- Use the project's established dependency versions

### Agent Guidelines
- Read CLAUDE.md before starting any task
- Check .claude/agents/ for task-specific instructions
- Respect the current mode settings
- Log actions when cost tracking is enabled
`;
}

function generateClaudeMd(config: UserConfig): string {
  return `# CLAUDE.md

## Project: ${config.projectName}

This project uses meowkit for AI-assisted development configuration.
See CLAUDE.md for detailed project conventions and guidelines.

### Quick Reference
- Stack: ${config.stack.join(", ")}
- Mode: ${config.defaultMode}
- Tool: ${config.primaryTool}

### Rules
- Always read CLAUDE.md at the start of a session
- Follow the agent files in .claude/agents/ for specialized tasks
- Respect .meowkit.config.json settings
${config.enableMemory ? "- Use .claude/memory/ for cross-session context\n" : ""}\
${config.enableCostTracking ? "- Log token usage via .claude/hooks/post-task\n" : ""}\
`;
}

function generateConfigJson(config: UserConfig): string {
  const configObj = {
    $schema: "https://meowkit.dev/schema/config.json",
    version: "1.0.0",
    project: {
      name: config.projectName,
      stack: config.stack,
    },
    team: {
      size: config.teamSize,
    },
    tool: {
      primary: config.primaryTool,
    },
    mode: {
      default: config.defaultMode,
    },
    features: {
      costTracking: config.enableCostTracking,
      memory: config.enableMemory,
    },
  };

  return JSON.stringify(configObj, null, 2) + "\n";
}

function generateAgentFile(name: string, description: string, instructions: string): string {
  return `# Agent: ${name}

## Description
${description}

## Instructions
${instructions}
`;
}

function generateHookScript(hookName: string, body: string): string {
  return `#!/usr/bin/env bash
# meowkit hook: ${hookName}
set -euo pipefail

${body}
`;
}

function buildFileMap(config: UserConfig, targetDir: string): Map<string, { content: string; executable: boolean }> {
  const files = new Map<string, { content: string; executable: boolean }>();
  const meowkit = join(targetDir, ".claude");

  // Root-level files
  files.set(join(targetDir, "CLAUDE.md"), {
    content: generateMeowkitMd(config),
    executable: false,
  });

  files.set(join(targetDir, ".meowkit.config.json"), {
    content: generateConfigJson(config),
    executable: false,
  });

  // Universal agent files
  files.set(join(meowkit, "agents", "code-review.md"), {
    content: generateAgentFile(
      "Code Review",
      "Reviews code changes for quality, correctness, and style.",
      [
        "- Check for common bugs and anti-patterns",
        "- Verify test coverage for changes",
        "- Ensure consistent code style",
        "- Flag security concerns",
        `- Operating mode: ${config.defaultMode}`,
      ].join("\n")
    ),
    executable: false,
  });

  files.set(join(meowkit, "agents", "testing.md"), {
    content: generateAgentFile(
      "Testing",
      "Writes and maintains tests for the project.",
      [
        "- Write unit tests for new functions",
        "- Maintain integration test coverage",
        "- Follow existing test patterns and conventions",
        `- Stack: ${config.stack.join(", ")}`,
      ].join("\n")
    ),
    executable: false,
  });

  files.set(join(meowkit, "agents", "refactor.md"), {
    content: generateAgentFile(
      "Refactor",
      "Safely refactors code while preserving behavior.",
      [
        "- Make incremental changes with tests",
        "- Preserve public API contracts",
        "- Improve readability and maintainability",
        "- Document breaking changes",
      ].join("\n")
    ),
    executable: false,
  });

  files.set(join(meowkit, "agents", "docs.md"), {
    content: generateAgentFile(
      "Documentation",
      "Writes and updates project documentation.",
      [
        "- Keep docs in sync with code changes",
        "- Use clear, concise language",
        "- Include code examples where helpful",
        "- Follow the project's doc style",
      ].join("\n")
    ),
    executable: false,
  });

  files.set(join(meowkit, "agents", "debug.md"), {
    content: generateAgentFile(
      "Debug",
      "Investigates and fixes bugs.",
      [
        "- Reproduce the issue first",
        "- Use systematic debugging approaches",
        "- Write a regression test for each fix",
        "- Document root cause in commit message",
      ].join("\n")
    ),
    executable: false,
  });

  files.set(join(meowkit, "agents", "planning.md"), {
    content: generateAgentFile(
      "Planning",
      "Helps plan features, architecture, and tasks.",
      [
        "- Break down large tasks into smaller steps",
        "- Consider edge cases and failure modes",
        "- Identify dependencies and risks",
        `- Team size: ${config.teamSize}`,
      ].join("\n")
    ),
    executable: false,
  });

  // Hooks
  files.set(join(meowkit, "hooks", "pre-task"), {
    content: generateHookScript(
      "pre-task",
      [
        '# Runs before each agent task',
        'echo "[meowkit] Starting task at $(date -u +%Y-%m-%dT%H:%M:%SZ)"',
        "",
        "# Validate environment",
        'if [ ! -f CLAUDE.md ]; then',
        '  echo "[meowkit] Warning: CLAUDE.md not found in project root"',
        "fi",
      ].join("\n")
    ),
    executable: true,
  });

  files.set(join(meowkit, "hooks", "post-task"), {
    content: generateHookScript(
      "post-task",
      [
        "# Runs after each agent task",
        'echo "[meowkit] Task completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"',
        "",
        config.enableCostTracking
          ? [
              "# Log cost tracking data",
              'COST_LOG=".claude/logs/cost.jsonl"',
              'mkdir -p "$(dirname "$COST_LOG")"',
              'echo "{\\\"timestamp\\\": \\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\\", \\\"task\\\": \\\"${MEOWKIT_TASK:-unknown}\\\"}" >> "$COST_LOG"',
            ].join("\n")
          : "# Cost tracking disabled",
      ].join("\n")
    ),
    executable: true,
  });

  // Memory directory
  if (config.enableMemory) {
    files.set(join(meowkit, "memory", ".gitkeep"), {
      content: "",
      executable: false,
    });
  }

  // Logs directory
  if (config.enableCostTracking) {
    files.set(join(meowkit, "logs", ".gitkeep"), {
      content: "",
      executable: false,
    });
  }

  // Tool-specific files
  if (config.primaryTool === "claude-code" || config.primaryTool === "both") {
    files.set(join(meowkit, "tools", "claude-code.md"), {
      content: `# Claude Code Configuration

## Settings
- Default mode: ${config.defaultMode}
- Memory: ${config.enableMemory ? "enabled" : "disabled"}

## Usage
This file provides Claude Code-specific instructions.
Refer to CLAUDE.md for project-wide conventions.

## Allowed Commands
- git status, git diff, git log
- npm test, npm run lint (or equivalent for your stack)
- File read/write operations within the project

## Restricted Actions
- Do not push to remote without confirmation
- Do not modify CI/CD configuration without review
- Do not install new dependencies without discussion
`,
      executable: false,
    });
  }

  if (config.primaryTool === "antigravity" || config.primaryTool === "both") {
    files.set(join(meowkit, "tools", "antigravity.md"), {
      content: `# Antigravity Configuration

## Settings
- Default mode: ${config.defaultMode}
- Memory: ${config.enableMemory ? "enabled" : "disabled"}

## Usage
This file provides Antigravity-specific instructions.
Refer to CLAUDE.md for project-wide conventions.

## Workspace Integration
- Follow VS Code workspace settings
- Respect .editorconfig if present
- Use workspace-relative paths
`,
      executable: false,
    });
  }

  return files;
}

export async function generate(
  config: UserConfig,
  targetDir: string,
  dryRun: boolean
): Promise<number> {
  const files = buildFileMap(config, targetDir);

  for (const [filePath, { content, executable }] of files) {
    writeFile(filePath, content, dryRun, executable);
  }

  if (!dryRun) {
    console.log(pc.green(`  Created ${files.size} files`));
  }

  return files.size;
}
