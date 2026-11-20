#!/usr/bin/env node
// `sessionStart` adapter: emits a small, bounded `additional_context` pointer.
// Never blocking (sessionStart has no permission/continue field in the
// documented contract) and cloud-unsupported by Cursor itself (no session
// boundary concept in cloud agents, per the docs report's IDE/CLI/Cloud
// support matrix) — nothing here needs its own cloud gate, Cursor simply
// never invokes this hook there.
"use strict";
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { projectRoot, emit } = require("./lib/cursor-hook-runtime.cjs");

const root = projectRoot();
const ledgerExists = existsSync(join(root, ".meowkit", "state", "cursor-ledger.json"));

const lines = [
	"MeowKit-managed Cursor project.",
	"State, telemetry, and locks live under .meowkit/ (never .cursor/).",
	ledgerExists
		? "Reconciliation ledger present at .meowkit/state/cursor-ledger.json."
		: "No reconciliation ledger found yet — run `mewkit doctor` for install health.",
];

emit({ additional_context: lines.join("\n") });
