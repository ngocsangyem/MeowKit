import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pc from "picocolors";
import type { UserConfig } from "./prompts.js";

const PREFIX = "__MEOWKIT_";
const SUFFIX = "__";

/** Builds placeholder → value map from user config */
function buildReplacements(config: UserConfig): Record<string, string> {
  return {
    [`${PREFIX}DESCRIPTION${SUFFIX}`]: config.description || "",
    [`${PREFIX}COST_TRACKING${SUFFIX}`]: String(config.enableCostTracking),
    [`${PREFIX}MEMORY_ENABLED${SUFFIX}`]: String(config.enableMemory),
  };
}

/** Process a .template file: substitute placeholders, write to destPath */
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
