// Minimal ambient declaration for the experimental `node:sqlite` builtin (Node 22.5+).
// @types/node@20 does not ship it yet; this declares only the surface the derived-index
// module uses. The runtime API is exercised by the tests, so any drift surfaces there —
// not hidden behind these types. Remove once @types/node is bumped to a version that
// ships sqlite.d.ts.
declare module "node:sqlite" {
	interface StatementSync {
		run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
		get(...params: unknown[]): Record<string, unknown> | undefined;
		all(...params: unknown[]): Record<string, unknown>[];
	}
	interface DatabaseSyncOptions {
		readOnly?: boolean;
	}
	export class DatabaseSync {
		constructor(path: string, options?: DatabaseSyncOptions);
		exec(sql: string): void;
		prepare(sql: string): StatementSync;
		close(): void;
	}
}
