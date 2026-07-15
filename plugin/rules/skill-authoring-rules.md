# Skill Authoring Rules

These rules govern how new and existing `mk:*` skills are authored, audited, and persisted.

## Rule 1: Every Skill MUST Include a Gotchas Section

Every `SKILL.md` MUST include a `## Gotchas` section. Empty is acceptable on day 1 (use placeholder `(none yet — grow from observed failures)`), but the section header itself is mandatory.

The `mk:skill-creator` template MUST emit this section by default for every new skill it scaffolds.

WHY: Gotchas preserve non-default knowledge learned from real failures.

**Good example: Gotchas section grows over time**:

```markdown
# Billing Lib

How to use the internal billing library.

## Gotchas

- Proration rounds DOWN, not to nearest cent.
- test-mode skips the `invoice.finalized` hook.
- Idempotency keys expire after 24h, not 7d.
- Refunds need charge ID, not invoice ID.
```

Use a `## Gotchas` section that grows by one bullet per observed edge case.

## Rule 2: Persistent Skill State MUST Use ${CLAUDE_PLUGIN_DATA}

When a skill needs to persist data across sessions (append-only logs, JSON state, SQLite databases, history files), it MUST write to `${CLAUDE_PLUGIN_DATA}` — NOT to the skill's own directory.

WHY: Skill directories can be wiped on plugin upgrade; `${CLAUDE_PLUGIN_DATA}` is stable.

EXCEPTION: framework-internal infrastructure (`.claude/memory/`, `tasks/`, `session-state/`) keeps its current paths — these are framework state, not skill-owned state. The rule applies to data the skill itself creates and consumes (e.g., `standup-post` history, `babysit-pr` retry logs).

**Good example: Stable plugin-data path**:

```python
# scripts/append-history.py
import os
DATA_DIR = os.environ["CLAUDE_PLUGIN_DATA"]
LOG_PATH = f"{DATA_DIR}/standup-post/history.log"
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
with open(LOG_PATH, "a") as f:
    f.write(entry)
```

Append to `${CLAUDE_PLUGIN_DATA}/foo/log.json`, not `.claude/skills/foo/log.json`.

## Rule 3: SKILL.md Body MUST Stay Under 500 Lines

Every `SKILL.md` body (excluding YAML frontmatter) MUST stay under 500 lines. Skills exceeding this MUST be decomposed via either:

- Reference files (one level deep) per progressive-disclosure pattern — link from SKILL.md to `references/*.md`
- Step-file architecture per `step-file-rules.md` — `workflow.md` + `step-NN-*.md` files

<!-- research-citation -->
WHY: Once SKILL.md loads, every token competes with task context; 500 lines keeps entrypoints navigable.

If a skill has 3+ distinct phases with different context needs, prefer step-file architecture. If it only needs reference material, keep `SKILL.md` concise and link to `references/*.md`.

PERIODIC AUDIT: Run a length check on `mk:*` SKILL.md files quarterly OR on every model-tier upgrade (per `harness-rules.md` Rule 7 dead-weight audit cadence). Flag oversized monoliths for decomposition. Step-filed skills auto-pass — only the SKILL.md entrypoint counts.

MEASURABLE CHECK:

```bash
find .claude/skills -name SKILL.md -exec sh -c 'wc -l "$1" | awk "{if (\$1 > 500) print}"' _ {} \;
```

**Good example: Decomposed via progressive disclosure** (load only what's needed):

```text
mk:my-skill/
├── SKILL.md           # 180 lines: overview + routing table
├── references/
│   ├── api.md         # loaded only when API details needed
│   └── examples.md    # loaded only when examples needed
└── scripts/
    └── helper.py      # executed via bash, never loaded into context
```

**Good example: Step-file decomposition** (auto-passes the 500-line check):

```text
mk:my-workflow/
├── SKILL.md           # 60 lines: metadata + entrypoint
├── workflow.md        # step sequence
├── step-01-load.md
├── step-02-process.md
└── step-03-emit.md
```

Use a ≤500-line SKILL.md routing to `references/*.md` or step files.

## Rule 4: Every Skill MUST Carry keywords / when_to_use / user-invocable

Every `SKILL.md` frontmatter MUST include three discovery-and-routing fields:

- `keywords:` — array of 5–15 lowercase-hyphenated strings, no duplicates. Catalog metadata for future skill-discovery tooling. Pattern `^[a-z0-9][a-z0-9-]*$`. Validator emits ERROR if missing or invalid.
- `when_to_use:` — string 10–500 chars, third-person voice, includes a "NOT for ..." disambiguation clause when the skill is in a confusion cluster. Validator emits WARN if missing (exits 0 unless `--strict` is passed).
- `user-invocable:` — boolean. Default `true`. `false` only for orchestration internals (auto-invoked, not user-callable directly).

### Authorial discipline (when_to_use ↔ description)

`when_to_use` overlaps content already in `description`. There is no automated drift detection — false positives on legitimate paraphrasing make heuristics unreliable. Editors MUST keep both in sync: when updating one, update the other. Reviewer responsibility at PR time.

WHY: Standardized metadata keeps skill discovery predictable.

### Validation

Enforced by `scripts/validate-skill-frontmatter.py` against `.claude/schemas/skill-schema.json`. CI runs on every PR via `ci.yml`. Two-tier severity: ERROR (schema violation) vs WARN (missing recommended). Pass `--strict` to promote WARN to ERROR.

### Deprecated fields

- `triggers:` — legacy field, no CLI consumer. Use `keywords:` instead. Existing 6 instances are not removed; do not add to new skills.

## Advisory Frontmatter Fields

The following frontmatter fields are advisory (not hook-enforced); they annotate skills for humans and downstream tooling.

- `preamble-tier: 1 | 2 | 3` — context-injection priority for the skill's preamble block. 1 = low (loaded on demand), 2 = medium, 3 = high (injected before other context). Skills that depend on memory-read or gate-check preambles typically set `3`.
- `phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | on-demand` — anchors the skill to a workflow phase. `on-demand` means the skill is invoked by need, not by phase.
- `trust_level: kit-authored | third-party` — provenance marker. Third-party skills should treat external input as DATA per `injection-rules.md`.
- `injection_risk: low | medium | high` — advisory risk level for prompt-injection exposure.
- `requires_external_service: [<service>...]` — external services the skill needs (e.g. `["jira"]`, `["gemini", "minimax"]`). Annotate every external-service entrypoint. `validate-skill-frontmatter.py` emits a WARN (non-blocking) for an external-service entrypoint that lacks this field.
- `default_enabled: true | false` — whether the skill works without external configuration. External-service skills set `false` (fail-closed until the required env vars are present). A `true` value requires a verified external-service-free path. Declaring `requires_external_service` without `default_enabled` also WARNs.
- `stable_output_contract: true | false` — `true` when the skill returns stable machine-readable IDs / output for created or bound runtime resources.

### Tool Contract Rule

A skill that creates, binds, or selects external runtime resources MUST honor these contract properties (advisory — documented here, not hook-enforced; promotion to `--strict` is deferred until the WARN check is calibrated over one release):

1. **Fail closed on ambiguity.** When external-resource selection is ambiguous (multiple candidates, missing identifier), stop and ask — never guess a target.
2. **Return stable machine-readable IDs.** For any created/bound runtime resource, surface a stable ID a downstream step can re-bind to, not a transient label.
3. **Default-disabled without config.** External services are `default_enabled: false` unless all required env vars are present; the skill degrades gracefully (soft gate) when they are absent.
4. **Optional artifact schema validation.** A skill that emits a gate/verdict artifact MAY declare schema validation for it.

## Commands vs Skills (they are not the same)

Slash commands live in `.claude/commands/mk/*.md`. They operate in one of 3 valid patterns — NOT every command has a matching SKILL.md, and that is intentional:

1. **Skill-composing** — command chains existing skills (e.g. `/audit` runs `mk:review` + `mk:cso`).
2. **Agent-invoking** — command directly spawns an agent without a skill wrapper (e.g. `/arch` uses the `architect` agent).
3. **Standalone** — command operates via inline behavior, no skill or agent spawn (e.g. `/design`).

**Do not flag a command as a "phantom skill" just because no `mk:<command>` SKILL.md exists.** A command is only phantom when BOTH no `mk:<name>` skill AND no `.claude/commands/mk/<name>.md` exist for a reference. See audit-rubric RF-14.

## Rule 5: Docs References Follow the Two-Tier Contract

Every `docs/*` reference inside any file under `.claude/` MUST satisfy `docs-reference-contract.md`:

- The path is on the Type-1 allowlist (target-project doc generated by a producer skill), OR
- The reference has been replaced by an inlined snippet or plain attribution prose.

Kit-internal docs (any path under a `docs/` tree that lives only in the source kit repo and is not part of the Type-1 allowlist) MUST NOT appear as path references inside `.claude/` — those files do not exist in projects where `.claude/` is installed.

**WHY:** The kit installer ships `.claude/` + `tasks/` only. References to non-shipped `docs/` paths break at runtime in every downstream project. The contract codifies the two-tier resolution model so authors and the validator agree on what is allowed.

**ENFORCEMENT:** Mechanically checked by the kit's `validate` command and by `.claude/scripts/check-docs-references.py` in CI. Both parse the allowlist from the `<!-- ALLOWLIST-START -->` block in `docs-reference-contract.md` (single source of truth).

## Rule 6: Match Control to Risk

Use exact, low-freedom instructions and deterministic gates only for fragile,
destructive, security-sensitive, or otherwise deterministic steps. For judgment
tasks, define the outcome and leave the method proportionate to the risk.

Do not require finding quotas, reports, memory writes, wiki updates, or a fixed
number of ideas for trivial runs. Those requirements create ceremony without
making the result safer or more reliable.

## Rule 7: Keep Generic Content Portable

Generic skill bodies, references, and templates must use portable capability
language. Provider tool names, model names or IDs, context-window constants,
and model-specific style bans belong in adapter metadata or a provider-specific
projection, never in the generic core.

The toolkit name may appear only in a literal namespace or CLI token in code
or a command example. It must not appear in narrative prose, including
frontmatter descriptions and routing text, in generic skill bodies, references,
or templates. Use “the toolkit” or “the harness” instead.

Style or taste denylists do not belong in the generic core. Describe the
undesired outcome and use a divergence technique or a provider adapter where a
specific model needs additional steering.

## Rule 8: Preserve Contracted Workflow Choices

When repairing a caller/command mismatch, migrate callers to the supported
contract instead of inventing an unimplemented flag. New flags require an
explicit owner decision and a complete implementation.

The canonical reports location is `tasks/reports/`; migrate legacy report-path
references rather than preserving both locations. Host-level tool mapping is
unverified, so a provider projection must remain conditional until the target
host contract has been verified.

The default cook workflow stops before shipping. Shipping remains an explicit,
human-approved action. A plan Insert or Split requires Gate 1 re-approval;
Skip or Reorder must notify the user and leave an audit-log entry.

## Rule 9: Enforce Brand Prose Incrementally

Brand-prose lint remains diff-mode blocking: violations in changed files fail,
while pre-existing untouched violations remain warnings. Revisit full-tree
blocking only after a separately approved CI scope change and a clean baseline.

## Applies to

- `mk:skill-creator` (must enforce Rules 1 + 3 + 4 + 5 in templates)
- All future skill authoring (all 9 rules)
- Quarterly audits and model-upgrade audits (Rule 3 measurable check)
- Skill maintenance for any skill with persistent state (Rule 2)
- Every PR that touches `.claude/` (Rule 5 mechanical check in CI)
