import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pc from "picocolors";
import type { UserConfig } from "./prompts.js";

/** Placeholder prefix to avoid collision with {{}} in Vue/GitHub Actions */
const PREFIX = "__MEOWKIT_";
const SUFFIX = "__";

/**
 * Builds a map of placeholder keys to their replacement values from user config.
 */
function buildReplacements(config: UserConfig): Record<string, string> {
  return {
    [`${PREFIX}PROJECT_NAME${SUFFIX}`]: config.projectName,
    [`${PREFIX}STACK${SUFFIX}`]: config.stack.join(", "),
    [`${PREFIX}STACK_JSON${SUFFIX}`]: JSON.stringify(config.stack),
    [`${PREFIX}TEAM_SIZE${SUFFIX}`]: config.teamSize,
    [`${PREFIX}DEFAULT_MODE${SUFFIX}`]: config.defaultMode,
    [`${PREFIX}PRIMARY_TOOL${SUFFIX}`]: config.primaryTool,
    [`${PREFIX}COST_TRACKING${SUFFIX}`]: String(config.enableCostTracking),
    [`${PREFIX}MEMORY_ENABLED${SUFFIX}`]: String(config.enableMemory),
  };
}

/**
 * Reads a .template file, substitutes __MEOWKIT_*__ placeholders,
 * and writes the result to destPath (without .template extension).
 */
export function processTemplate(
  templatePath: string,
  destPath: string,
  config: UserConfig,
  dryRun: boolean
): void {
  if (dryRun) {
    console.log(`  ${pc.dim("create")} ${destPath}`);
    return;
  }

  let content = readFileSync(templatePath, "utf-8");
  const replacements = buildReplacements(config);

  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
  }

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content, "utf-8");
}
