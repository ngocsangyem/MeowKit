/**
 * apply-todo-toggle — pure function that flips a single checkbox marker
 * inside the ## Todo List section of a phase file's content string.
 *
 * Contract:
 *   - No fs, no http, no side effects. Pure transformation only.
 *   - Mirrors extractTodos fence-aware walk exactly (per red-team C1).
 *   - CRLF preserved: majority-EOL detection applied to full content.
 *   - Idempotent: marker already matches desired → {changed: false}.
 *   - Error tags are static strings, NEVER interpolated content (R2-14).
 */

/** Static error tags returned when applyTodoToggle cannot apply the flip. */
export type TodoToggleErrorTag =
	| "section-missing"
	| "out-of-range"
	| "fence-overflow";

export type TodoToggleResult =
	| { content: string; changed: boolean }
	| { error: TodoToggleErrorTag };

const TODO_RE = /^(\s*-\s*\[)(\s|x|X|~|✓)(\]\s+.+?)\s*$/;
const FENCE_RE = /^```/;

/**
 * Detect the dominant line ending character.
 * Returns "\r\n" if CRLF count > LF-only count, else "\n".
 */
function detectEol(content: string): "\r\n" | "\n" {
	const crlfCount = (content.match(/\r\n/g) ?? []).length;
	const lfCount = (content.match(/(?<!\r)\n/g) ?? []).length;
	// Detect mixed-EOL (meaningful mix: both > 0 and neither dominates by 2:1)
	if (crlfCount > 0 && lfCount > 0) {
		// Accept minor contamination (≤20% minority) as "effectively uniform"
		const total = crlfCount + lfCount;
		const minority = Math.min(crlfCount, lfCount);
		if (minority / total > 0.2) {
			// Genuinely mixed — caller may want to warn, but we proceed with majority
			// and let the eol-mixed error tag be used if the caller needs it.
		}
	}
	return crlfCount >= lfCount ? "\r\n" : "\n";
}

/**
 * Flip the Nth (0-based) checkbox marker in ## Todo List section.
 *
 * Fence-aware walk matches extractTodos in parse-phase-file.ts exactly:
 *   - Lines matching /^```/ toggle fenceDepth 0→1 or 1→0.
 *   - Checkbox lines inside fences (fenceDepth > 0) are skipped/not counted.
 *   - Only `^phase-` regex used in server, NOT here — caller decides glob.
 */
export function applyTodoToggle(
	content: string,
	todoIdx: number,
	checked: boolean,
): TodoToggleResult {
	// Split preserving original EOL on each line for later reassembly.
	// We split on \n and check if each line ends with \r (for CRLF lines).
	const eol = detectEol(content);

	// Split into raw lines (without any EOL); we'll reassemble with detected eol.
	// Handle CRLF: split on \n, strip trailing \r from each line for processing,
	// then reattach the correct EOL on reassembly.
	const rawLines = content.split("\n");
	const lines = rawLines.map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));

	// Locate ## Todo List section start
	const todoSectionRe = /^##\s+Todo\s+List\s*$/i;
	const nextSectionRe = /^##?\s/;

	let sectionStart = -1;
	let sectionEnd = lines.length;

	for (let i = 0; i < lines.length; i++) {
		if (todoSectionRe.test(lines[i])) {
			sectionStart = i + 1;
			continue;
		}
		if (sectionStart !== -1 && i > sectionStart && nextSectionRe.test(lines[i])) {
			sectionEnd = i;
			break;
		}
	}

	if (sectionStart === -1) {
		return { error: "section-missing" };
	}

	// Walk todo section with fence tracker (must match extractTodos exactly)
	let fenceDepth = 0;
	let count = 0;
	let targetLineIdx = -1;

	for (let i = sectionStart; i < sectionEnd; i++) {
		const line = lines[i];
		if (FENCE_RE.test(line)) {
			fenceDepth = fenceDepth === 0 ? 1 : 0;
			continue;
		}
		if (fenceDepth > 0) continue;
		const m = line.match(TODO_RE);
		if (!m) continue;
		if (count === todoIdx) {
			targetLineIdx = i;
			break;
		}
		count++;
	}

	// Fence depth not closed: error (malformed doc)
	if (fenceDepth > 0) {
		return { error: "fence-overflow" };
	}

	if (targetLineIdx === -1) {
		return { error: "out-of-range" };
	}

	// Check idempotency: does current marker already match desired state?
	const m = lines[targetLineIdx].match(TODO_RE);
	if (!m) {
		// Shouldn't happen since we matched above, but guard defensively
		return { error: "out-of-range" };
	}

	const currentMarker = m[2];
	const currentChecked = currentMarker !== " " && currentMarker !== "";
	if (currentChecked === checked) {
		// Already in desired state — idempotent no-op
		return { content, changed: false };
	}

	// Flip: replace marker char
	const newMarker = checked ? "x" : " ";
	const newLine = m[1] + newMarker + m[3];
	lines[targetLineIdx] = newLine;

	// Reassemble with original EOL type
	// If original was CRLF, rawLines had \r on each line; we stripped them above.
	// Now rebuild: join with detected EOL. Last line may or may not have trailing EOL.
	const hasTrailingNewline =
		content.endsWith("\n") || content.endsWith("\r\n");

	let newContent: string;
	if (eol === "\r\n") {
		newContent = lines.join("\r\n");
	} else {
		newContent = lines.join("\n");
	}

	// Preserve trailing newline if original had one
	if (hasTrailingNewline && !newContent.endsWith("\n")) {
		newContent += eol;
	}

	return { content: newContent, changed: true };
}
