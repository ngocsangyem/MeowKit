// Pure path builders for the runtime-neutral `.meowkit/` taxonomy. NO filesystem
// side effects — callers create directories explicitly on write paths only. The
// migration lock lives under state/ (single lock authority, relocated from the
// legacy `.mewkit/.lock`); per-store locks live under state/locks/.
import { join } from "node:path";

export interface MeowkitStatePaths {
	base: string;
	memory: string;
	telemetry: string;
	state: string;
	cache: string;
	migrations: string;
	/** Single project/migration lock authority (was `.mewkit/.lock`). */
	migrateLock: string;
	/** Directory holding per-store granularity locks that nest under the project lock. */
	storeLocksDir: string;
}

/** Build the taxonomy paths from a resolved `.meowkit/` directory. */
export function meowkitStatePaths(meowkitRoot: string): MeowkitStatePaths {
	const state = join(meowkitRoot, "state");
	return {
		base: meowkitRoot,
		memory: join(meowkitRoot, "memory"),
		telemetry: join(meowkitRoot, "telemetry"),
		state,
		cache: join(meowkitRoot, "cache"),
		migrations: join(meowkitRoot, "migrations"),
		migrateLock: join(state, "migrate.lock"),
		storeLocksDir: join(state, "locks"),
	};
}
