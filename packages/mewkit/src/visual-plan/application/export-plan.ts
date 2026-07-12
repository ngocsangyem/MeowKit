/**
 * `export --format html` — render the CURRENT artifact into ONE self-contained,
 * offline `plan.html`. The output carries the artifact's `review.status` in its
 * header, so a draft export is never mistaken for final; the plan-creator flow
 * (Step 8b) calls this only AFTER approval, making that export the canonical one.
 *
 * Safety: every plan-sourced string is HTML-escaped; wireframes are re-sanitized
 * before inlining; there are no `<script>` tags and no auto-fetching elements
 * (no `img`/`src`/`link`), so the page opens with zero network requests. A
 * wireframe `<a href>` to a remote host is permitted but inert until clicked.
 */

import { readArtifactRaw } from "../infrastructure/visual-plan-repository.js";
import { sanitizeWireframeHtml } from "../infrastructure/wireframe-sanitizer.js";
import { computeCoverage } from "../domain/coverage.js";
import { VisualPlanSchema, type VisualPlan } from "../domain/schemas.js";

export interface ExportResult {
	ok: boolean;
	html?: string;
	error?: string;
}

/** HTML-entity-encode a plan-sourced string for safe text/attribute placement. */
function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function coverageSection(plan: VisualPlan): string {
	const { summary } = computeCoverage(plan);
	const rows = plan.uiCoverage.surfaces
		.flatMap((s) => s.states.map((st) => `<tr><td>${esc(s.label ?? s.id)}</td><td>${esc(st.label ?? st.id)}</td><td>${st.frameIds.length > 0 ? "framed" : st.omitted ? esc(st.omitted.reason) : "unresolved"}</td></tr>`))
		.join("");
	return `<h2>Coverage</h2><p class="vp-sum">${summary.resolved} resolved · ${summary.planned} planned · ${summary.omitted} omitted · ${summary.unresolved} unresolved</p><table><thead><tr><th>Surface</th><th>State</th><th>Closure</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function framesSection(plan: VisualPlan): string {
	const cards = plan.canvas.frames
		.map((f) => `<article class="vp-frame"><header><strong>${esc(f.label)}</strong> <span class="vp-badge">${esc(f.surface)} · ${esc(f.changeMode)}</span></header><div class="wf-root">${sanitizeWireframeHtml(f.wireframe.html)}</div></article>`)
		.join("");
	return `<h2>Frames</h2><div class="vp-frames">${cards}</div>`;
}

function docsSection(plan: VisualPlan): string {
	if (plan.documentBlocks.length === 0) return "";
	const items = plan.documentBlocks.map((b) => `<li>${b.title ? `<strong>${esc(b.title)}:</strong> ` : ""}${esc(b.body)}</li>`).join("");
	return `<h2>Mechanics</h2><ul>${items}</ul>`;
}

const STYLE = `body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#1c2430}
h1{margin:0 0 4px}h2{margin:24px 0 8px;border-bottom:1px solid #d7dbe0;padding-bottom:4px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7dbe0;padding:4px 8px;text-align:left;font-size:13px}
.vp-sum{color:#64707d}.vp-frames{display:flex;flex-wrap:wrap;gap:16px}
.vp-frame{border:1px solid #d7dbe0;border-radius:8px;overflow:hidden;width:340px}
.vp-frame header{padding:6px 10px;border-bottom:1px solid #d7dbe0;background:#f4f5f7}
.vp-badge{color:#64707d;font-size:12px}.wf-root{padding:10px}.wf-root .wf-button{display:inline-block;padding:6px 12px;background:#3563e9;color:#fff;border-radius:6px;text-decoration:none}
.wf-root .wf-input{height:30px;border:1px solid #d7dbe0;border-radius:6px;background:#eef1f4}.wf-root .wf-error{color:#c0392b}`;

/** Build the self-contained plan.html string from the artifact at `planDir`. */
export function exportPlanHtml(planDir: string): ExportResult {
	const read = readArtifactRaw(planDir);
	if (read.error) return { ok: false, error: read.error.message };
	const parsed = VisualPlanSchema.safeParse(read.raw);
	if (!parsed.success) return { ok: false, error: "artifact must be schema-valid to export" };
	const plan = parsed.data;

	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.id)} — visual plan</title><style>${STYLE}</style></head><body><h1>${esc(plan.id)}</h1><p class="vp-sum">revision ${plan.revision} · review ${esc(plan.review.status)}</p>${coverageSection(plan)}${framesSection(plan)}${docsSection(plan)}</body></html>\n`;
	return { ok: true, html };
}
