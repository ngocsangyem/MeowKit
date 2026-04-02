/**
 * Append-only merge for .claude/settings.json.
 * Adds new MeowKit hooks/permissions without modifying existing user entries.
 * Backs up before merge, restores on failure.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import * as log from "./core-logger.js";

interface HookEntry {
  type?: string;
  command: string;
  timeout?: number;
  statusMessage?: string;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  permissions?: { allow?: string[] };
  [key: string]: unknown;
}

/**
 * Merge template settings.json into existing user settings.json.
 * Strategy: append-only — add new hooks/permissions, never modify existing.
 * Returns true if merge succeeded, false if skipped or failed.
 */
export function mergeSettingsFile(
  templatePath: string,
  destPath: string,
  dryRun: boolean
): boolean {
  if (!existsSync(templatePath)) {
    log.debug("Template settings.json not found, skipping merge");
    return false;
  }

  // If dest doesn't exist, just copy
  if (!existsSync(destPath)) {
    if (!dryRun) {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(templatePath, destPath);
    }
    log.debug("settings.json: fresh copy (no existing file)");
    return true;
  }

  if (dryRun) {
    log.debug("settings.json: would merge (dry-run)");
    return true;
  }

  // Read both files
  let userSettings: Settings;
  let templateSettings: Settings;

  try {
    userSettings = JSON.parse(readFileSync(destPath, "utf-8")) as Settings;
  } catch {
    log.warn("settings.json: invalid JSON in existing file, skipping merge");
    return false;
  }

  try {
    templateSettings = JSON.parse(readFileSync(templatePath, "utf-8")) as Settings;
  } catch {
    log.warn("settings.json: invalid JSON in template, skipping merge");
    return false;
  }

  // Backup before merge
  const backupPath = destPath + ".bak";
  copyFileSync(destPath, backupPath);

  try {
    const merged = appendOnlyMerge(userSettings, templateSettings);
    writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
    log.debug("settings.json: merged successfully");
    return true;
  } catch (err) {
    // Restore backup on failure
    copyFileSync(backupPath, destPath);
    log.warn(`settings.json merge failed, restored backup: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** Append-only merge: add new template entries to user settings without modifying existing */
function appendOnlyMerge(user: Settings, template: Settings): Settings {
  const result = { ...user };

  // Merge hooks: add new hook matchers that don't exist in user's config
  if (template.hooks) {
    if (!result.hooks) result.hooks = {};

    for (const [event, templateMatchers] of Object.entries(template.hooks)) {
      if (!result.hooks[event]) {
        // Entire hook event is new — add it
        result.hooks[event] = templateMatchers;
        continue;
      }

      // Event exists — add only matchers with commands not already present
      const userMatchers = result.hooks[event];
      const userCommands = extractCommandStrings(userMatchers);

      for (const templateMatcher of templateMatchers) {
        const newHooks = templateMatcher.hooks.filter(
          (h) => !userCommands.has(normalizeCommand(h.command))
        );

        if (newHooks.length > 0) {
          // Find existing matcher with same matcher pattern, or create new
          const existingMatcher = userMatchers.find(
            (m) => (m.matcher ?? "") === (templateMatcher.matcher ?? "")
          );

          if (existingMatcher) {
            existingMatcher.hooks.push(...newHooks);
          } else {
            userMatchers.push({ ...templateMatcher, hooks: newHooks });
          }
        }
      }
    }
  }

  // Merge permissions.allow: union of arrays
  if (template.permissions?.allow) {
    if (!result.permissions) result.permissions = {};
    if (!result.permissions.allow) result.permissions.allow = [];

    const existingSet = new Set(result.permissions.allow);
    for (const perm of template.permissions.allow) {
      if (!existingSet.has(perm)) {
        result.permissions.allow.push(perm);
      }
    }
  }

  return result;
}

/** Extract all command strings from hook matchers for deduplication */
function extractCommandStrings(matchers: HookMatcher[]): Set<string> {
  const commands = new Set<string>();
  for (const matcher of matchers) {
    for (const hook of matcher.hooks) {
      commands.add(normalizeCommand(hook.command));
    }
  }
  return commands;
}

/** Normalize command string for comparison (trim whitespace, collapse spaces) */
function normalizeCommand(cmd: string): string {
  return cmd.trim().replace(/\s+/g, " ");
}
