/**
 * Canonical valid `visual-plan/v1` fixture (as a builder returning a fresh deep
 * copy each call, so a test can mutate one failure class without touching
 * others). Source hashes are left empty here — the test helper stamps them from
 * the on-disk plan.md/phase files so the "valid" case passes freshness.
 *
 * The wireframe HTML uses only the allowed `.wf-*` structural vocabulary and no
 * form controls, so it survives the reject-mode sanitizer unchanged.
 */

const SAFE_LOGIN_HTML =
	'<section class="wf-screen"><header class="wf-topbar"><h1>Sign in</h1></header>' +
	'<div class="wf-form"><label>Email</label><div class="wf-input"></div>' +
	'<label>Password</label><div class="wf-input"></div>' +
	'<a href="#submit" class="wf-button">Continue</a></div></section>';

const SAFE_ERROR_HTML =
	'<section class="wf-screen"><header class="wf-topbar"><h1>Sign in</h1></header>' +
	'<p class="wf-error">Incorrect email or password.</p>' +
	'<div class="wf-form"><label>Email</label><div class="wf-input"></div></div></section>';

/** A structurally + referentially valid artifact. Deep-copied on every call. */
export function makeValidPlan(): Record<string, unknown> {
	return JSON.parse(JSON.stringify(BASE)) as Record<string, unknown>;
}

/** Markdown the fixture's source hashes are computed against. */
export const FIXTURE_PLAN_MD = "# Sample Plan\n\nAuth flow.\n";
export const FIXTURE_PHASE_MD = "---\nphase: 1\n---\n\n# Phase 1\n\nLogin screen.\n";

const BASE = {
	schemaVersion: "visual-plan/v1",
	id: "sample-plan",
	revision: 0,
	source: { planPath: "plan.md", planHash: "", phaseHashes: {} as Record<string, string> },
	uiCoverage: {
		surfaces: [
			{
				id: "s-auth",
				label: "Authentication",
				states: [
					{ id: "st-login-default", label: "Login (default)", frameIds: ["fr-login"], sourceRefIds: ["ref-login-code"] },
					{ id: "st-login-error", label: "Login (error)", frameIds: ["fr-login-error"], sourceRefIds: [] },
					{ id: "st-forgot", label: "Forgot password", frameIds: [], sourceRefIds: [], omitted: { reason: "out-of-scope" } },
					{ id: "st-2fa", label: "2FA", frameIds: [], sourceRefIds: [], omitted: { reason: "equivalent-layout", representedBy: "st-login-default" } },
				],
			},
		],
	},
	canvas: {
		lanes: [{ id: "lane-primary", label: "Primary flow" }],
		frames: [
			{
				id: "fr-login",
				label: "Login",
				surface: "browser",
				laneId: "lane-primary",
				order: 0,
				changeMode: "current",
				coverageStateIds: ["st-login-default"],
				sourceRefIds: ["ref-login-code"],
				wireframe: { format: "semantic-html", html: SAFE_LOGIN_HTML },
			},
			{
				id: "fr-login-error",
				label: "Login error",
				surface: "browser",
				laneId: "lane-primary",
				order: 1,
				changeMode: "target",
				coverageStateIds: ["st-login-error"],
				sourceRefIds: [],
				wireframe: { format: "semantic-html", html: SAFE_ERROR_HTML },
			},
		],
		connectors: [{ id: "c-login-error", from: "fr-login", to: "fr-login-error", label: "invalid credentials" }],
		annotations: [{ id: "an-note-1", kind: "note", text: "Primary CTA", targetId: "fr-login", placement: "top" }],
	},
	documentBlocks: [{ id: "db-mechanics", title: "Mechanics", body: "Session cookie set on success." }],
	sourceRefs: [
		{ id: "ref-login-code", kind: "code", ref: "src/features/auth/login.tsx" },
		{ id: "ref-new-2fa", kind: "plan-requirement", ref: "phase-01#2fa" },
	],
	review: { status: "draft", approvedRevision: null, approvedAt: null, pendingFeedbackBatchIds: [] as string[] },
};
