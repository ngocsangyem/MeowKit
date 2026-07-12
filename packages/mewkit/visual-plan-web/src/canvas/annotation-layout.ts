/**
 * Note-annotation gutter layout — pure + deterministic.
 *
 * A `note` sits in a gutter column just right of its target frame, aligned to the
 * frame top. Multiple notes sharing a column stack downward with a constant gap;
 * a note that would overlap the one above is shifted down (collision shift). Real
 * heights are measured at runtime (ResizeObserver) and fed in here; the layout
 * itself is a pure function so the collision behavior is unit-testable.
 */

export const NOTE_WIDTH = 200;
const GUTTER_OFFSET = 24;
const GAP = 12;
const DEFAULT_NOTE_HEIGHT = 56;

export interface NoteInput {
	id: string;
	targetX: number;
	targetY: number;
	targetWidth: number;
	/** Measured height; falls back to a constant before first measure. */
	height?: number;
}

export interface PlacedNote {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Place notes into per-target gutter columns, shifting to avoid vertical overlap. */
export function layoutNotes(notes: NoteInput[]): PlacedNote[] {
	const byColumn = new Map<number, NoteInput[]>();
	for (const n of notes) {
		const columnX = n.targetX + n.targetWidth + GUTTER_OFFSET;
		const list = byColumn.get(columnX) ?? [];
		list.push(n);
		byColumn.set(columnX, list);
	}

	const placed: PlacedNote[] = [];
	for (const [columnX, list] of byColumn) {
		const sorted = [...list].sort((a, b) => (a.targetY - b.targetY) || a.id.localeCompare(b.id));
		let prevBottom = -Infinity;
		for (const n of sorted) {
			const height = n.height ?? DEFAULT_NOTE_HEIGHT;
			const y = Math.max(n.targetY, prevBottom + GAP);
			placed.push({ id: n.id, x: columnX, y, width: NOTE_WIDTH, height });
			prevBottom = y + height;
		}
	}
	return placed;
}
