// Resolving the CLI's own entry from its module URL — the decoding step, on the path shapes
// that are ordinary everywhere except in a URL.
//
// A URL path is percent-encoded, so decoding it as a filesystem path turns a directory named
// with a space or a non-ASCII character into one that does not exist. The install then writes
// neither the launcher nor the runtime descriptor and reports only a warning, which is the
// quietest possible way for the whole mechanism to be absent.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runningCliEntry } from "../project-launcher.js";

describe("resolving the running CLI's own entry", () => {
	/** A `dist/` layout under a directory name that a URL would have to escape. */
	function distUnder(dirName: string): { moduleUrl: string; entry: string } {
		const base = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-url-"));
		const dist = path.join(base, dirName, "dist");
		fs.mkdirSync(path.join(dist, "core"), { recursive: true });
		const entry = path.join(dist, "index.js");
		fs.writeFileSync(entry, "// entry\n", "utf-8");
		const self = path.join(dist, "core", "project-launcher.js");
		fs.writeFileSync(self, "// module\n", "utf-8");
		return { moduleUrl: pathToFileURL(self).href, entry: fs.realpathSync(entry) };
	}

	it("resolves through a directory whose name has a space", () => {
		const { moduleUrl, entry } = distUnder("dir with space");
		expect(runningCliEntry(moduleUrl)).toBe(entry);
	});

	it("resolves through a directory whose name is not ASCII", () => {
		// A URL path percent-encodes both of these, so decoding it as a filesystem path is
		// what used to turn an ordinary install location into a path that does not exist.
		const { moduleUrl, entry } = distUnder("josé münchen");
		expect(runningCliEntry(moduleUrl)).toBe(entry);
	});

	it("resolves a plain ASCII path, the case that always worked", () => {
		const { moduleUrl, entry } = distUnder("plain");
		expect(runningCliEntry(moduleUrl)).toBe(entry);
	});

	it("still refuses a module URL with no entry beside it, rather than inventing one", () => {
		const base = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-url-"));
		const self = path.join(base, "dist", "core", "project-launcher.js");
		fs.mkdirSync(path.dirname(self), { recursive: true });
		fs.writeFileSync(self, "// module\n", "utf-8");
		expect(() => runningCliEntry(pathToFileURL(self).href)).toThrow();
	});
});
