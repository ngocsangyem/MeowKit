# Target-Specific Notes (annotation adapters)

> Loaded by `mk:prompt-enhancer` ONLY when BOTH hold: `--analyze` is active AND
> the input explicitly names a target model or runtime ("for Claude", "for
> Codex", "targeting Gemini", "Droid/Factory"). It renders one optional
> **"Target-specific notes"** block after Section 3 of the analysis.
>
> **Hard rules (from the confirmed design decisions):**
> - There is **no `--target` flag.** Target notes are analysis-only annotation.
> - Notes **never change the rewrite** (Section 4). The Enhanced Prompt stays the
>   universal kernel, byte-identical to what the no-target run would produce.
> - Default mode (no flag) and any run without an explicit target emit **nothing**
>   from this file — silent fallback.
> - Notes are *steering hints for the user*, not vendor prompt text pasted in.
>   Never copy a vendor's proprietary prompt verbatim; describe the technique.

## Contents

1. [When this file renders](#when-this-file-renders)
2. [Adapter table](#adapter-table)
3. [Render format](#render-format)
4. [Guards](#guards)

---

## When this file renders

All of:

- `--analyze` (or `--analyze --score`) is set — never in default mode.
- The input names a concrete target model or runtime.
- A draftable prompt exists (same route gate as any run).

If the target is ambiguous ("make it good for my AI") → do NOT guess a vendor;
render no target block.

---

## Adapter table

Techniques are surfaced as NOTES to the user, grounded in each vendor's own
prompting guidance (see the model-specific matrix in the strategy report). They
describe *what to consider*; they do not rewrite the kernel.

| Adapter | When (input names) | Added techniques (notes only) | Must NOT do | Risk |
|---|---|---|---|---|
| **default** | no target | universal kernel; neutral `--- DATA ---` fence | — | none (baseline) |
| **claude** | Claude / Anthropic | may use XML sections for very complex prompts; long documents near the top, instruction after; explicit tool/safety boundaries | force XML into the default rewrite; add "think step by step"; role-as-XML | Claude-izing a portable enhancer |
| **codex** | Codex / OpenAI / GPT | autonomy + persistence; codebase exploration; tool/patch discipline; concise progress updates | inject `apply_patch` / CLI boilerplate into a generic prompt; assume a harness | Harness leakage |
| **gemini** | Gemini | concise direct instruction; `thinking_level` control; put the long-context question last; state media resolution | low-temperature advice; legacy `thinking_budget`; force chain-of-thought scaffolds | Misprompting Gemini |
| **droid/factory** | Droid / Factory | structured outcome; explicit acceptance criteria; role/task framing | treat the refiner taxonomy as a mandate; assume one behavior for all models | Over-structuring |
| **augment-style** | user asks for pre-processing / editable draft | present the rewrite as an editable draft + a bounded context-slice of `[FILL-IN]` anchors | claim a proprietary context engine, router, or any performance metric (unverified) | Overreach on unverified claims |

---

## Render format

Append after Section 3 (analysis), before Section 4 (the rewrite):

```
### Target-specific notes — <target>

> These are steering hints for <target>. The Enhanced Prompt below is unchanged
> (universal kernel) — apply these only if you are sending it to <target>.

- <technique 1 relevant to the input>
- <technique 2>
- Avoid: <the "must not do" item(s) for this target>
```

Keep to 2–5 bullets. Cite nothing vendor-proprietary. If none of the target's
techniques apply to this particular prompt, say "No target-specific tuning adds
value for this prompt" rather than padding.

---

## Guards

- **Never mutate the rewrite.** Section 4 is identical with or without a target.
  A convergence canary asserts this (default vs analyze-with-target rewrite body
  must match).
- **One target at a time.** If the input names two, note both only if the user
  asked; otherwise pick the explicitly-stated one and ask which for the rest.
- **No flag.** Do not invent `--target`; the block is triggered by explicit
  target mention in `--analyze` input only.
- **No verbatim vendor prompts / no unverified metrics** (esp. augment-style).
