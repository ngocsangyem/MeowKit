// Preflight + final-summary printers for `mewkit migrate`. Console output only.

import pc from "picocolors";
import type {
	ReconcileBanner,
	ReconcileAction,
	ReconcilePlan,
} from "./reconcile/reconcile-types.js";
import type { InstallResult } from "./portable-installer.js";

export interface PreflightContext {
	source: { root: string; origin: string };
	skippedShellHooks: number;
	bannerExtras: string[];
}

export function printPreflight(plan: ReconcilePlan, ctx: PreflightContext): void {
	console.log();
	console.log(pc.bold("Migrate plan"));
	console.log(`  ${pc.dim("Source:")} ${ctx.source.root} ${pc.dim(`(${ctx.source.origin})`)}`);
	console.log();
	console.log(`  install:  ${pc.green(String(plan.summary.install))}`);
	console.log(`  update:   ${pc.cyan(String(plan.summary.update))}`);
	console.log(`  skip:     ${pc.dim(String(plan.summary.skip))}`);
	console.log(`  conflict: ${pc.yellow(String(plan.summary.conflict))}`);
	console.log(`  delete:   ${pc.red(String(plan.summary.delete))}`);

	if (plan.banners.length > 0) {
		console.log();
		for (const banner of plan.banners) {
			printBanner(banner);
		}
	}

	if (ctx.skippedShellHooks > 0) {
		console.log();
		console.log(
			pc.yellow(
				`[!] ${ctx.skippedShellHooks} shell hook(s) skipped (only node-runnable .cjs/.mjs/.js hooks migrate).`,
			),
		);
	}

	for (const extra of ctx.bannerExtras) {
		console.log(pc.dim(`[i] ${extra}`));
	}
}

function printBanner(banner: ReconcileBanner): void {
	if (banner.kind === "empty-dir") console.log(pc.cyan(`[i] ${banner.message}`));
	else console.log(pc.dim(`[i] ${banner.message}`));
}

export function printActionDetails(actions: ReconcileAction[]): void {
	if (actions.length === 0) return;

	const groups = new Map<string, ReconcileAction[]>();
	for (const action of actions) {
		const list = groups.get(action.action) ?? [];
		list.push(action);
		groups.set(action.action, list);
	}

	for (const [kind, list] of groups) {
		console.log();
		console.log(pc.bold(`${kind} (${list.length}):`));
		for (const action of list.slice(0, 10)) {
			console.log(
				`  ${pc.dim(action.provider)}/${action.type} ${pc.cyan(action.item)} — ${pc.dim(action.reasonCopy ?? action.reason)}`,
			);
		}
		if (list.length > 10) console.log(pc.dim(`  … and ${list.length - 10} more`));
	}
}

export function printFinalSummary(results: InstallResult[]): void {
	const succeeded = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success);

	console.log();
	console.log(pc.bold("Migration complete"));
	console.log(`  ${pc.green(`${succeeded} succeeded`)}`);
	if (failed.length > 0) {
		console.log(`  ${pc.red(`${failed.length} failed`)}`);
		for (const result of failed.slice(0, 5)) {
			console.log(
				`    ${pc.red("✗")} ${result.action.provider}/${result.action.type}/${result.action.item}: ${result.error ?? "unknown error"}`,
			);
		}
	}
}
