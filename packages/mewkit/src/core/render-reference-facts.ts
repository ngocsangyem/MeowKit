// The generated "at a glance" block spliced into every skill and agent reference page.
//
// It carries only what the source file actually declares. That constraint is the whole point:
// a generated block that fills gaps with defaults states things nobody asserted, which is worse
// than the hand-written clone it replaces. Phase is the clearest case — 40 agent pages document
// a real phase and no agent frontmatter carries one, so phase stays hand-written and is absent
// here rather than defaulted to something false.
//
// Markers are MDX expression comments. HTML comments fail the MDX build outright, so this
// deliberately does not reuse the capability view's `<!-- -->` syntax.
import type { DocsReferenceEntry } from "./docs-reference-manifest.js";

export const FACTS_START = "{/* GENERATED:reference-facts START */}";
export const FACTS_END = "{/* GENERATED:reference-facts END */}";

const SOURCE_BASE = "https://github.com/ngocsangyem/MeowKit/blob/main/.claude/";

/** A literal `|` would end the Markdown table cell it sits in. */
function cell(text: string): string {
	return text.replace(/\|/g, "\\|");
}

function list(values: string[]): string | null {
	return values.length === 0 ? null : values.map((v) => `\`${cell(v)}\``).join(", ");
}

/**
 * Render the block for one artifact. Rows whose value is undeclared are omitted rather than
 * printed empty: a table full of dashes teaches a reader that the data is missing, when what is
 * true is that the artifact never claimed it.
 */
export function renderReferenceFacts(entry: DocsReferenceEntry): string {
	const rows: [string, string | null][] = [
		["Source", `[\`.claude/${entry.sourcePath}\`](${SOURCE_BASE}${entry.sourcePath})`],
		["Owner", entry.owner ? `\`${cell(entry.owner)}\`` : null],
		["Runtime", entry.runtime ? `\`${cell(entry.runtime)}\`` : null],
		["Risk", entry.risk ? cell(entry.risk) : null],
		["Phase", entry.phase ? `\`${cell(entry.phase)}\`` : null],
		["Depends on", list(entry.dependencies)],
		["Writes", list(entry.output)],
		["Last verified", entry.lastVerified ? cell(entry.lastVerified) : null],
	];

	const present = rows.filter((r): r is [string, string] => r[1] !== null);
	return [
		FACTS_START,
		"",
		"| | |",
		"|---|---|",
		...present.map(([label, value]) => `| **${label}** | ${value} |`),
		"",
		FACTS_END,
	].join("\n");
}

/**
 * Put the block into a page, replacing any previous one.
 *
 * A page with no marker gets it directly below the frontmatter, which is the one position that
 * is mechanically reliable across 167 pages of differing structure. Everything outside the
 * markers is returned untouched — that is the contract the whole splice rests on.
 */
export function spliceReferenceFacts(body: string, block: string): string {
	const start = body.indexOf(FACTS_START);
	const end = body.indexOf(FACTS_END);
	if (start !== -1 && end > start) {
		return body.slice(0, start) + block + body.slice(end + FACTS_END.length);
	}

	const fm = /^---\n[\s\S]*?\n---\n/.exec(body);
	if (!fm) return `${block}\n\n${body}`;
	return `${fm[0]}\n${block}\n${body.slice(fm[0].length)}`;
}
