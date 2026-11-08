// The two config readers cannot disagree.
//
// There are two on purpose: the CLI has js-yaml, a hook has no npm dependencies
// at all and parses the file by hand. Two parsers for one file is a divergence
// waiting to happen, and the session where it happens is a fresh clone with a
// gate about to fire — so the proof is not "both look right" but a corpus fed to
// both, compared verdict for verdict and key for key.
//
// A fixture is named for what it asserts: `accept-` parses, `grammar-` is
// outside the subset, `reject-` parses but says something a committed file must
// not say.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyRules } from "../../packages/mewkit/src/config/config-rules.js";
import { observerNames } from "../../packages/mewkit/src/config/observer-names.js";
import { resolveConfig } from "../../packages/mewkit/src/config/precedence.js";
import { checkGrammar, flatten } from "../../packages/mewkit/src/config/yaml-grammar.js";

const require_ = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const FIXTURES = join(HERE, "fixtures");

const HOOK_READER_REL = ".claude/hooks/lib/yaml-subset.cjs";
const HOOK_RULES_REL = ".claude/hooks/lib/config-rules.cjs";

interface HookReader {
	parseYamlSubset: (source: string) => { ok: true; values: Record<string, unknown> } | { ok: false; error: { code: string; line: number } };
}
interface HookRules {
	applyRules: (
		values: Record<string, unknown>,
		options: { root: string; scope?: string },
	) => { ok: true; values: Record<string, unknown> } | { ok: false; error: { code: string; key: string } };
}

const hookReader = require_(join(REPO_ROOT, HOOK_READER_REL)) as HookReader;
const hookRules = require_(join(REPO_ROOT, HOOK_RULES_REL)) as HookRules;
const names = observerNames(REPO_ROOT);

const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".yaml")).sort();

/** The CLI verdict: grammar, then js-yaml for values, then the rules. */
function cliVerdict(source: string): { ok: boolean; code?: string; values?: Record<string, unknown> } {
	const grammar = checkGrammar(source);
	if (grammar !== null) return { ok: false, code: grammar.code };
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { load } = require_("js-yaml") as { load: (s: string) => unknown };
	const document = load(source);
	const flat = document === null || document === undefined ? {} : flatten(document);
	const ruled = applyRules(flat, names, "project config");
	if (!ruled.ok) return { ok: false, code: ruled.error.code };
	return { ok: true, values: ruled.values };
}

/** The hook verdict, through the vendored reader and the hook-side rules. */
function hookVerdict(source: string): { ok: boolean; code?: string; values?: Record<string, unknown> } {
	const parsed = hookReader.parseYamlSubset(source);
	if (!parsed.ok) return { ok: false, code: parsed.error.code };
	const ruled = hookRules.applyRules(parsed.values, { root: REPO_ROOT, scope: "project config" });
	if (!ruled.ok) return { ok: false, code: ruled.error.code };
	return { ok: true, values: ruled.values };
}

describe("the hook reader and the CLI reader agree on every fixture", () => {
	it("has a corpus covering every grammar and rejection class", () => {
		expect(fixtures.length).toBeGreaterThanOrEqual(12);
		for (const prefix of ["accept-", "grammar-", "reject-"]) {
			expect(fixtures.filter((f) => f.startsWith(prefix)).length, prefix).toBeGreaterThan(0);
		}
	});

	for (const fixture of fixtures) {
		it(`${fixture} — same verdict and same keys`, () => {
			const source = readFileSync(join(FIXTURES, fixture), "utf8");
			const cli = cliVerdict(source);
			const hook = hookVerdict(source);

			expect(hook.ok, `${fixture}: verdicts differ (cli ${cli.ok}, hook ${hook.ok}; cli code ${cli.code}, hook code ${hook.code})`).toBe(cli.ok);
			if (cli.ok) {
				// Structural, not stringified: two shapes that print alike can still
				// differ in a value's type, which is exactly the divergence that
				// would matter.
				expect(hook.values).toEqual(cli.values);
			} else {
				expect(hook.code, `${fixture}: both rejected but for different reasons`).toBe(cli.code);
			}
		});
	}

	// Fixture agreement is structural. This one is the whole chain, because the
	// consequence is an enforcement mode: a spelling that one side resolved and
	// the other did not had strict test-first mode reported ON by the CLI and
	// enforced as OFF by the gate, with no error anywhere.
	// Two spellings, one symptom: a value the full parser resolves to a boolean
	// and the hand reader keeps as text. The tag case is the same shape as the
	// case spelling one step out — deliberate YAML rather than a typo — and had
	// the same consequence, so both are driven end to end.
	const END_TO_END: Array<[string, string, string]> = [
		["tdd: True\n", "bad-boolean-spelling", "lower case"],
		["tdd: !!bool true\n", "tag-not-supported", "plain value"],
	];
	for (const [source, code, phrase] of END_TO_END) {
		it(`${JSON.stringify(source.trim())} is refused by the gate's reader and by the CLI alike`, () => {
			const dir = mkdtempSync(join(tmpdir(), "mewkit-tdd-"));
			mkdirSync(join(dir, ".meowkit"), { recursive: true });
			writeFileSync(join(dir, ".meowkit", "config.yaml"), source, "utf8");
			const emptyHome = mkdtempSync(join(tmpdir(), "mewkit-home-"));
			try {
				const { isTddEnabled } = require_(join(REPO_ROOT, ".claude/hooks/lib/tdd-detect.cjs")) as {
					isTddEnabled: (o: { root: string; env: Record<string, string> }) => { enabled: boolean; source: string };
				};
				expect(isTddEnabled({ root: dir, env: {} })).toEqual({ enabled: false, source: "default" });

				const resolved = resolveConfig({ root: dir, observerNames: names, env: {}, home: emptyHome });
				expect(resolved.values.tdd, "the CLI resolved a value the gate does not see").toBeUndefined();
				expect(resolved.errors.map((e) => e.code)).toEqual([code]);
				expect(resolved.errors[0]?.message).toContain(phrase);
			} finally {
				rmSync(dir, { recursive: true, force: true });
				rmSync(emptyHome, { recursive: true, force: true });
			}
		});
	}

	it(`${HOOK_READER_REL} and its rules require nothing from node_modules`, () => {
		const seen = new Set<string>();
		const queue = [HOOK_READER_REL, HOOK_RULES_REL];
		const external: string[] = [];
		while (queue.length > 0) {
			const rel = queue.shift() as string;
			if (seen.has(rel)) continue;
			seen.add(rel);
			const source = readFileSync(join(REPO_ROOT, rel), "utf8");
			for (const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
				const target = match[1] as string;
				if (target.startsWith(".")) queue.push(join(dirname(rel), target));
				else if (!target.startsWith("node:")) external.push(`${rel} -> ${target}`);
			}
		}
		expect(external, "a hook path reached a package").toEqual([]);
		for (const rel of seen) expect(rel.startsWith(".claude/"), rel).toBe(true);
	});
});
