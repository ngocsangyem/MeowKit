/**
 * FeedbackDraftPanel — accumulate SEMANTIC feedback operations (copy/field/flow/
 * scope changes) with an `intent`, then `Prepare Feedback` (a barrier: only when
 * the save queue is clean) POSTs them into an immutable batch and reveals the
 * Copy Command. Copy is enabled ONLY after the batch is durably written; adding a
 * new op invalidates a prepared batch (clears the command). Semantic changes are
 * applied by the agent (Phase 6), never by the studio.
 */

import { useState } from "react";
import { postFeedback } from "../api/client.js";

const OP_TYPES = ["copy-change", "field-change", "flow-change", "scope-change", "other"] as const;
type OpType = (typeof OP_TYPES)[number];
interface DraftOp {
	type: OpType;
	intent: string;
}

export function FeedbackDraftPanel({ canPrepare }: { canPrepare: boolean }) {
	const [ops, setOps] = useState<DraftOp[]>([]);
	const [type, setType] = useState<OpType>("copy-change");
	const [intent, setIntent] = useState("");
	const [copyCommand, setCopyCommand] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const add = (): void => {
		if (!intent.trim()) return;
		setOps((prev) => [...prev, { type, intent: intent.trim() }]);
		setIntent("");
		setCopyCommand(null); // a new op invalidates a prepared batch
		setCopied(false);
	};

	const prepare = async (): Promise<void> => {
		setBusy(true);
		setErr(null);
		const r = await postFeedback(ops);
		setBusy(false);
		if (r.ok) setCopyCommand(r.copyCommand ?? null);
		else setErr(r.error ?? "could not prepare feedback");
	};

	const copy = (): void => {
		if (!copyCommand) return;
		void navigator.clipboard?.writeText(copyCommand).then(() => setCopied(true)).catch(() => setCopied(false));
	};

	return (
		<section className="vp-feedback" aria-label="Feedback draft">
			<h2 className="vp-panel-title">Feedback</h2>
			<ul className="vp-feedback-ops">
				{ops.map((o, i) => (
					<li key={i}><span className="vp-fb-type">{o.type}</span> {o.intent}</li>
				))}
			</ul>
			<select aria-label="Feedback type" value={type} onChange={(e) => setType(e.target.value as OpType)}>
				{OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
			</select>
			<textarea aria-label="Intent" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="What should change, and why?" />
			<button type="button" onClick={add} disabled={!intent.trim()}>Add</button>
			<button type="button" className="vp-fb-prepare" onClick={() => void prepare()} disabled={ops.length === 0 || busy || !canPrepare}>
				{busy ? "Preparing…" : "Prepare Feedback"}
			</button>
			{!canPrepare ? <p className="vp-fb-hint">Save pending edits before preparing feedback.</p> : null}
			{err ? <p className="vp-fb-hint" role="alert">{err}</p> : null}
			{copyCommand ? (
				<div className="vp-copy-command">
					<code>{copyCommand}</code>
					<button type="button" onClick={copy}>{copied ? "Copied" : "Copy Command"}</button>
				</div>
			) : null}
		</section>
	);
}
