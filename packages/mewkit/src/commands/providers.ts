import pc from "picocolors";
import {
	collectProviderSupportMatrix,
	findProviderSupportInfo,
	type ProviderSupportInfo,
	type ProviderSupportMatrix,
} from "../migrate/provider-support-summary.js";
import { describeProvider, ADAPTED_PROVIDERS, type ProviderAdapterView } from "../core/provider-adapter.js";
import { LIFECYCLE_EVENTS } from "../core/provider-lifecycle.js";

export interface ProvidersCliArgs {
	provider?: string;
	json?: boolean;
	/** Show the Phase-6 capability-adapter view: 4 support levels + acquisition + lifecycle matrix. */
	lifecycle?: boolean;
}

const ROLE_LABELS: Record<ProviderSupportInfo["role"], string> = {
	"full-harness": "full harness",
	"hard-gate-candidate": "hard-gate candidate",
	procedure: "procedure",
	"policy-advisory": "policy/advisory",
	"config-only": "config-only",
	disabled: "disabled",
	deprecated: "deprecated",
};

export async function providersCommand(args: ProvidersCliArgs = {}): Promise<void> {
	// Phase-6 capability-adapter view (additive; the default matrix below is unchanged).
	if (args.lifecycle === true) {
		renderAdapterView(args.provider, args.json === true);
		return;
	}

	const matrix = collectProviderSupportMatrix();
	if (args.json === true) {
		const payload = args.provider ? findProviderSupportInfo(args.provider, matrix) : matrix;
		if (payload === null) {
			console.error(pc.red(`Unknown provider: ${args.provider}`));
			process.exit(2);
		}
		console.log(JSON.stringify(payload, null, 2));
		return;
	}

	if (args.provider) {
		const provider = findProviderSupportInfo(args.provider, matrix);
		if (provider === null) {
			console.error(pc.red(`Unknown provider: ${args.provider}`));
			printProviderNames(matrix);
			process.exit(2);
		}
		printProviderDetail(provider);
		return;
	}

	printProviderMatrix(matrix);
}

function printProviderMatrix(matrix: ProviderSupportMatrix): void {
	const { counts } = matrix;
	console.log(pc.bold(pc.cyan("MeowKit provider support")));
	console.log(
		pc.dim(
			`${counts.total} known providers — ${counts.verified} verified, ${counts.experimental} experimental, ${counts.deprecated} deprecated; ${counts.enabledSurfaces} enabled documented surfaces`,
		),
	);
	console.log();
	console.log(`  ${pc.bold(`${pad("PROVIDER", 16)} ${pad("LEVEL", 12)} ${pad("ROLE", 20)} SURFACES`)}`);
	for (const provider of matrix.providers) {
		console.log(
			`  ${pad(provider.id, 16)} ${pad(formatLevel(provider.supportLevel), 12)} ${pad(ROLE_LABELS[provider.role], 20)} ${formatSurfaceList(provider.effectiveSurfaces)}`,
		);
	}
	console.log();
	console.log(pc.dim("Run `mewkit providers <provider>` for paths, disabled surfaces, docs, and enforcement level."));
}

function printProviderDetail(provider: ProviderSupportInfo): void {
	console.log(pc.bold(pc.cyan(`${provider.displayName} (${provider.id})`)));
	console.log(`  ${pc.dim("Support level:")} ${formatLevel(provider.supportLevel)}`);
	// The adapter's capability headline — the SAME value `--lifecycle` prints, so the two views can
	// never state contradictory support (Phase 1 truth unification). Shown only where an adapter
	// projection exists; migration-only providers have no capability claim to make.
	if (provider.capabilityStatus !== null) {
		console.log(`  ${pc.dim("Capability:")} ${formatCapabilityStatus(provider.capabilityStatus)} ${pc.dim("(adapter truth — see `--lifecycle`)")}`);
	}
	if (provider.supportReason !== null && provider.supportReason.length > 0) {
		console.log(`  ${pc.dim("Reason:")} ${provider.supportReason}`);
	}
	console.log(`  ${pc.dim("Role:")} ${ROLE_LABELS[provider.role]}`);
	console.log(`  ${pc.dim("Subagents:")} ${provider.subagents}`);
	console.log(`  ${pc.dim("Enabled surfaces:")} ${formatSurfaceList(provider.effectiveSurfaces)}`);
	console.log(`  ${pc.dim("Disabled surfaces:")} ${formatSurfaceList(provider.disabledSurfaces)}`);
	console.log(
		`  ${pc.dim("Enforcement:")} Gate 1 ${provider.enforcement.gate1}, Gate 2 ${provider.enforcement.gate2}, secret protection ${provider.enforcement.secretProtection}`,
	);
	console.log();
	console.log(pc.bold("Surfaces"));
	for (const surface of provider.surfaces) {
		const status = surface.enabled ? pc.green("enabled") : pc.dim("disabled");
		const path = surface.enabled ? ` → ${surface.projectPath ?? "(global only)"}` : "";
		console.log(`  ${pad(surface.label, 10)} ${pad(surface.status, 12)} ${status}${path}`);
		if (surface.enabled) {
			console.log(`  ${" ".repeat(24)}${pc.dim(`${surface.format ?? "unknown"} / ${surface.writeStrategy ?? "unknown"}`)}`);
		}
		if (surface.note !== undefined && surface.note.length > 0) {
			console.log(`  ${" ".repeat(24)}${pc.dim(surface.note)}`);
		}
	}
	if (provider.docs.length > 0) {
		console.log();
		console.log(pc.bold("Docs"));
		for (const doc of provider.docs) console.log(`  ${doc}`);
	}
}

function printProviderNames(matrix: ProviderSupportMatrix): void {
	console.log(pc.dim(`Known providers: ${matrix.providers.map((provider) => provider.id).join(", ")}`));
}

function formatLevel(level: ProviderSupportInfo["supportLevel"]): string {
	if (level === "verified") return pc.green(level);
	if (level === "experimental") return pc.yellow(level);
	return pc.red(level);
}

function formatCapabilityStatus(status: NonNullable<ProviderSupportInfo["capabilityStatus"]>): string {
	if (status === "supported") return pc.green(status);
	if (status === "partial" || status === "experimental") return pc.yellow(status);
	return pc.red(status);
}

function formatSurfaceList(surfaces: string[]): string {
	return surfaces.length > 0 ? surfaces.join(", ") : pc.dim("none");
}

function pad(value: string, width: number): string {
	return value.length >= width ? value : value + " ".repeat(width - value.length);
}

// ── Phase-6 capability-adapter view ────────────────────────────────────────────────────────

/** Render the P6 adapter view: a lifecycle-event matrix (all providers) or a single provider's
 * full adapter detail. JSON dumps `describeProvider` verbatim (auditable, machine-readable). */
function renderAdapterView(provider: string | undefined, json: boolean): void {
	if (json) {
		const payload = provider ? describeProvider(provider) : ADAPTED_PROVIDERS.map((p) => describeProvider(p));
		console.log(JSON.stringify(payload, null, 2));
		return;
	}
	if (provider) {
		printAdapterDetail(describeProvider(provider));
		return;
	}
	printLifecycleMatrix();
}

/** Glyph for a lifecycle status; a trailing `!` marks a proven gate (deny/block). */
function lifecycleCell(status: string, gate: boolean): string {
	const g = gate ? "!" : " ";
	if (status === "supported") return pc.green(`ok${g}`);
	if (status === "advisory") return pc.yellow(`adv${g}`);
	if (status === "unsupported") return pc.red(`no ${g}`);
	return pc.dim(`?  `);
}

function printLifecycleMatrix(): void {
	console.log(pc.bold(pc.cyan("Provider lifecycle-event support (Phase 6)")));
	console.log(pc.dim("ok = fires · adv = fires, version-gated/observe · no = absent · ? = unknown · ! = proven gate (deny/block)"));
	console.log();
	const views = ADAPTED_PROVIDERS.map((p) => describeProvider(p));
	console.log(`  ${pad("EVENT", 18)}${views.map((v) => pad(v.provider, 15)).join("")}`);
	for (const event of LIFECYCLE_EVENTS) {
		const cells = views.map((v) => pad(lifecycleCell(v.lifecycle[event].status, v.lifecycle[event].gate), 15)).join("");
		console.log(`  ${pad(event, 18)}${cells}`);
	}
	console.log();
	console.log(pc.dim("Run `mewkit providers <provider> --lifecycle` for support levels, acquisition, storage, and evidence."));
}

function printAdapterDetail(view: ProviderAdapterView): void {
	const p = view.projection;
	console.log(pc.bold(pc.cyan(`Capability adapter — ${view.provider} [${view.status}]`)));
	console.log(`  ${pc.dim("support levels:")} discoverable ${p.levels.discoverable}, selectable ${p.levels.selectable}, invocable ${p.levels.invocable}, enforceable ${p.levels.enforceable}`);
	console.log(`  ${pc.dim("bootstrap:")} ${p.bootstrapPlacement}`);
	console.log(`  ${pc.dim("acquisition:")} read ${view.acquisition.read?.tool ?? "(none)"}, search ${view.acquisition.search?.tool ?? "(none)"} [${view.acquisition.status}]`);
	console.log(`  ${pc.dim("storage:")} ${view.storageBoundary}`);
	console.log(`  ${pc.dim("gating events:")} ${view.gatingEvents.length ? view.gatingEvents.join(", ") : pc.yellow("none (no proven deny/block)")}`);
	// Security/privacy enforcement gaps — prominent, never buried (Phase 6 acceptance).
	if (view.enforcementGaps.length > 0) {
		console.log(pc.bold(pc.red(`  ⚠ security/privacy enforcement gaps (${view.enforcementGaps.length}):`)));
		for (const g of view.enforcementGaps) console.log(pc.red(`      ${g.event}: ${g.reason}`));
	} else {
		console.log(`  ${pc.dim("enforcement gaps:")} ${pc.green("none — all safety deny events can block")}`);
	}
	console.log();
	console.log(pc.bold("  Invocation shapes"));
	for (const [id, shape] of Object.entries(view.invocation)) {
		const tag = shape.support === "supported" ? pc.green(shape.support) : shape.support === "advisory" ? pc.yellow(shape.support) : shape.support === "unsupported" ? pc.dim(shape.support) : pc.dim(shape.support);
		console.log(`    ${pad(id, 16)} ${pad(tag, 12)} ${pc.dim(shape.operation)}`);
	}
	console.log();
	console.log(pc.bold("  Workflow operations"));
	for (const [op, shape] of Object.entries(view.operations)) {
		const tag =
			shape.support === "supported"
				? pc.green(shape.support)
				: shape.support === "local-fallback"
					? pc.yellow(shape.support)
					: shape.support === "permission-blocked"
						? pc.red(shape.support)
						: pc.dim(shape.support);
		console.log(`    ${pad(op, 16)} ${pad(tag, 12)} ${pc.dim(shape.operation)}`);
		// A fallback nobody is told about is indistinguishable from real support.
		if (shape.fallback) console.log(`    ${pad("", 16)} ${pc.dim(`↳ fallback: ${shape.fallback}`)}`);
	}
	console.log();
	console.log(pc.bold("  Lifecycle events"));
	for (const event of LIFECYCLE_EVENTS) {
		const s = view.lifecycle[event];
		const tag = s.status === "supported" ? pc.green(s.status) : s.status === "advisory" ? pc.yellow(s.status) : s.status === "unsupported" ? pc.red(s.status) : pc.dim(s.status);
		console.log(`    ${pad(event, 18)} ${tag}${s.gate ? pc.bold(" [gate]") : ""} ${pc.dim(`— ${s.evidence}`)}`);
	}
}
