import { findMemoryConflicts } from "./conflicts.js";

export interface PromotionCandidate {
	title: string;
	source: string;
	reason: string;
	proposedAction: string;
}

export function memoryPromotionCandidates(memoryDir: string): PromotionCandidate[] {
	return findMemoryConflicts(memoryDir).map((conflict) => ({
		title: `Resolve repeated memory conflict: ${conflict.key}`,
		source: conflict.store,
		reason: `${conflict.ids.length} entries disagree: ${conflict.ids.join(", ")}`,
		proposedAction: "Review entries and promote the resolved wording into a rule/checklist candidate.",
	}));
}
