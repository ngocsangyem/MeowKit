/**
 * Annotation layer. `note` annotations render as gutter cards beside their target
 * frame (heights measured via ResizeObserver, laid out with collision shift);
 * `markup` annotations render at their explicit world points. Notes draw a short
 * connector line to the target's right edge. Non-interactive overlay.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "../domain/artifact-types.js";
import type { PlacedFrame } from "./lane-layout.js";
import { layoutNotes, type NoteInput } from "./annotation-layout.js";

interface Props {
	annotations: Annotation[];
	placedById: Map<string, PlacedFrame>;
}

export function AnnotationLayer({ annotations, placedById }: Props) {
	const [heights, setHeights] = useState<Record<string, number>>({});
	const refs = useRef<Map<string, HTMLDivElement>>(new Map());

	const notes = annotations.filter((a) => a.kind === "note" && a.targetId && placedById.has(a.targetId));
	const markups = annotations.filter((a) => a.kind === "markup" && a.points && a.points.length > 0);

	const noteInputs: NoteInput[] = useMemo(
		() =>
			notes.map((a) => {
				const t = placedById.get(a.targetId as string) as PlacedFrame;
				return { id: a.id, targetX: t.x, targetY: t.y, targetWidth: t.width, height: heights[a.id] };
			}),
		[notes, placedById, heights],
	);
	const placedNotes = layoutNotes(noteInputs);
	const noteText = new Map(notes.map((a) => [a.id, a.text]));

	useEffect(() => {
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver((entries) => {
			setHeights((prev) => {
				const next = { ...prev };
				let changed = false;
				for (const e of entries) {
					const id = (e.target as HTMLElement).dataset.noteId;
					if (id && next[id] !== e.contentRect.height) {
						next[id] = e.contentRect.height;
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		});
		for (const el of refs.current.values()) ro.observe(el);
		return () => ro.disconnect();
	}, [placedNotes.length]);

	// Not aria-hidden: annotation prose carries author intent and must reach AT.
	return (
		<div className="vp-annotation-layer" role="list" aria-label="Annotations">
			{placedNotes.map((p) => (
				<div
					key={p.id}
					className="vp-note"
					role="listitem"
					data-note-id={p.id}
					ref={(el) => {
						if (el) refs.current.set(p.id, el);
						else refs.current.delete(p.id);
					}}
					style={{ position: "absolute", left: p.x, top: p.y, width: p.width }}
				>
					{noteText.get(p.id)}
				</div>
			))}
			{markups.map((a) => {
				const pt = a.points![0];
				return (
					<div key={a.id} className="vp-markup" role="listitem" style={{ position: "absolute", left: pt.x, top: pt.y }}>
						{a.text}
					</div>
				);
			})}
		</div>
	);
}
