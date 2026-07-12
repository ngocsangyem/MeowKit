/**
 * Browser read-model for the `visual-plan/v1` artifact.
 *
 * A deliberately small, dependency-free VIEW of the artifact the studio renders.
 * The canonical source of truth + validation is the Node-side Zod schema
 * (`src/visual-plan/domain/schemas.ts`); duplicating a thin read-model here keeps
 * the browser bundle free of Zod and decouples the Vite build from the Node
 * source tree. The server only ever sends artifacts that already passed that
 * schema, so the studio treats these fields as present-and-valid.
 */

export type Surface = "browser" | "desktop" | "mobile" | "popover" | "panel" | "dialog";
export type ChangeMode = "current" | "target" | "unchanged-context";

export interface Wireframe {
	format: "semantic-html";
	html: string;
}

export interface Frame {
	id: string;
	label: string;
	surface: Surface;
	laneId: string;
	order: number;
	x?: number;
	y?: number;
	stateKind?: string;
	changeMode: ChangeMode;
	coverageStateIds: string[];
	sourceRefIds: string[];
	wireframe: Wireframe;
}

export interface Lane {
	id: string;
	label?: string;
	kind?: string;
}

export interface Connector {
	id: string;
	from: string;
	to: string;
	label?: string;
}

export interface Annotation {
	id: string;
	kind: "note" | "markup";
	text: string;
	targetId?: string;
	placement?: "top" | "right" | "bottom" | "left";
	points?: { x: number; y: number }[];
}

export interface Omission {
	reason: string;
	representedBy?: string;
	riskId?: string;
	note?: string;
}

export interface CoverageState {
	id: string;
	label?: string;
	frameIds: string[];
	sourceRefIds: string[];
	omitted?: Omission;
}

export interface CoverageSurface {
	id: string;
	label?: string;
	states: CoverageState[];
}

export interface SourceRef {
	id: string;
	kind: "code" | "plan-requirement";
	ref: string;
	note?: string;
}

export interface DocumentBlock {
	id: string;
	title?: string;
	body: string;
}

export interface Review {
	status: string;
	approvedRevision: number | null;
	approvedAt: string | null;
	pendingFeedbackBatchIds: string[];
}

export interface VisualPlan {
	schemaVersion: "visual-plan/v1";
	id: string;
	revision: number;
	source: { planPath: string; planHash: string; phaseHashes: Record<string, string> };
	uiCoverage: { surfaces: CoverageSurface[] };
	canvas: { lanes: Lane[]; frames: Frame[]; connectors: Connector[]; annotations: Annotation[] };
	documentBlocks: DocumentBlock[];
	sourceRefs: SourceRef[];
	review: Review;
}
