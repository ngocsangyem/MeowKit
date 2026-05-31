import { statSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * True only for actual hook *scripts*. The validators previously treated every
 * `readdirSync(hooksDir)` entry as a hook and ran `accessSync(X_OK)` on it — but the
 * execute bit is also set on directories (traverse), so `lib/`, `handlers/`, `__tests__/`,
 * and non-scripts like `HOOKS_INDEX.md` / `handlers.json` were reported as "Hook executable".
 * This guard is the single definition shared by validate, validate-install, and doctor.
 *
 * A hook script is: a regular FILE, not an index/doc/json sidecar, and either a known
 * script extension (.sh/.cjs/.js/.mjs) OR an extensionless executable with a shell/node shebang.
 */

const HOOK_EXTENSIONS = new Set([".sh", ".cjs", ".js", ".mjs"]);
const EXCLUDED_BASENAMES = new Set(["HOOKS_INDEX.md", "handlers.json"]);

export function isHookScript(p: string): boolean {
	let stat;
	try {
		stat = statSync(p);
	} catch {
		return false;
	}
	if (!stat.isFile()) return false; // directories (lib/, handlers/, __tests__/) are never hooks

	const base = path.basename(p);
	if (EXCLUDED_BASENAMES.has(base)) return false;

	const ext = path.extname(base).toLowerCase();
	if (HOOK_EXTENSIONS.has(ext)) return true;

	// Allow a legitimately extensionless hook: executable + shell/node shebang.
	if (ext === "") {
		if ((stat.mode & 0o111) === 0) return false;
		try {
			const head = readFileSync(p, "utf8").slice(0, 128);
			return /^#!.*\b(sh|bash|dash|node|env)\b/.test(head);
		} catch {
			return false;
		}
	}

	return false; // .md, .json, .txt, …
}
