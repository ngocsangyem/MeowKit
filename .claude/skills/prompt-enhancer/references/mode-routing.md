# Mode Routing

> Loaded by `mk:prompt-enhancer` at Step 1 (Mode Select). Single source for
> which mode emits what, what each mode reads, and the two layered recipes.
> Authoritative rule owners are linked — this file routes, it does not restate.

## Contents

1. [Mode table](#mode-table)
2. [Recipes (layered, not flags)](#recipes-layered-not-flags)
3. [Rule owners](#rule-owners)

---

## Mode table

| Mode | Trigger | Output sections | Reads | Posture |
|---|---|---|---|---|
| **Default** | any draft, no flag | Section 4 (Enhanced Prompt) only | input + skill refs | minimal |
| **`--analyze`** | `--analyze` | Sections 1–4 (decomp + issues + suggestions + rewrite) | input + refs | minimal |
| **`--analyze --score`** | `--score` (auto-promotes) | Sections 1–3 + Score block + Section 4 | input + refs | minimal |
| **`--deep`** | opt-in, any mode | appends "Suggested context" sub-block + git-sha footer to Section 4 when scout returns ≥1 hit | allow-list ∩ ¬forbid-list | bounded (≤8f / 100L / 30s) |

Default output is byte-stable vs `--deep` for Sections 1–3 (convergence canary).
`--deep` only *adds* the sub-block + footer; it never alters the rewrite body.

## Recipes (layered, not flags)

Recipes are documented framings on top of existing modes — **no new flag, no
new reads**. They reshape the rewritten prompt; they never perform the work the
reshaped prompt asks for.

| Recipe | Layered on | What it reshapes | Hard boundary |
|---|---|---|---|
| **Architecture-review** | `--analyze --deep` + arch signal | `CONTEXT:` prioritizes ADRs / architecture docs / public interfaces / constraints; `ACCEPTANCE CRITERIA:` asks for findings (severity + evidence + decisions-needed); `OUTPUT FORMAT:` orders findings → trade-offs → recommendation | Rewrites the prompt to ASK for a review. Does **not** produce findings — that is `mk:review`. Full recipe: `references/architecture-review-mode.md` |
| **Research** | any mode (prompt shape) | Grounding framing + attention-anchoring (long data first, ask last) + discovery acceptance criteria | Frames a discovery prompt only. Performs **no** research / retrieval itself — that is `mk:scout` / the downstream agent |

Both recipes are guarded by canaries (`eval/canary-11-architecture-review.md`,
`eval/canary-12-research-prompt.md`) that fail on role confusion.

## Rule owners

Single authoritative location for each cross-cutting rule — do not restate:

- **Universal-kernel rule** (plain-markdown sections only; no XML / vendor
  tokens / model overlays) → `SKILL.md` Hard Constraints item 4.
- **Deep-mode allow/forbid + fallback policy** (caps, abort reasons, default-deny)
  → `references/deep-mode-scout.md`.
- **5 components + 10 detections** → `references/decomposition-checklist.md`.
- **Per-finding fixes + `--score` rubric** → `references/playbook.md`.
