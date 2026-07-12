/**
 * `visual-plan` command adapter — maps parsed argv into the visual-plan CLI
 * dispatcher. Thin by design (mirrors how other commands wrap their domain
 * module); all logic lives in `src/visual-plan/`.
 */

import { visualPlanCommand, type VisualPlanCliArgs } from "../visual-plan/interface/cli.js";

export interface VisualPlanArgs {
	subcommand?: string;
	planDir?: string;
	revision?: string | number;
	json?: boolean;
}

export function visualPlan(args: VisualPlanArgs): void {
	const cliArgs: VisualPlanCliArgs = {
		subcommand: args.subcommand,
		planDir: args.planDir,
		revision: args.revision,
		json: args.json,
	};
	visualPlanCommand(cliArgs);
}
