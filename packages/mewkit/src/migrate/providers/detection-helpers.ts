// Shared detection primitives consumed by every per-provider `config.ts`.
// `binaryCache` is exposed as a singleton Map so that the legacy
// `provider-registry.ts` re-export and the new per-provider config modules
// reference the SAME instance — splitting it across re-export paths would cause
// detection misses (ESM/CJS interop hazard).

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";

export const home = homedir();
export const cwd = process.cwd();
export const isWin = platform() === "win32";

export const binaryCache = new Map<string, boolean>();

function hasInstallSignal(path: string | null | undefined): boolean {
	if (!path || !existsSync(path)) return false;
	try {
		const stat = statSync(path);
		if (stat.isDirectory()) return readdirSync(path).length > 0;
		if (stat.isFile()) return true;
		return false;
	} catch {
		return false;
	}
}

export function hasAnyInstallSignal(paths: Array<string | null | undefined>): boolean {
	return paths.some((path) => hasInstallSignal(path));
}

export function hasBinaryInPath(name: string): boolean {
	const cached = binaryCache.get(name);
	if (cached !== undefined) return cached;
	try {
		execFileSync(isWin ? "where" : "which", [name], { stdio: "pipe", timeout: 3000 });
		binaryCache.set(name, true);
		return true;
	} catch {
		binaryCache.set(name, false);
		return false;
	}
}
