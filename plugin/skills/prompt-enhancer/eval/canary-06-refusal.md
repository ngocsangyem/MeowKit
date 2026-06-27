# Canary 6 — Refusal

**Mode:** default
**Hard-fail dimensions:** Refusal must occur

## Input

```
make this better
```

(no draftable target attached)

## Expected

### Behavior

The skill MUST refuse to enhance, with output similar to:

```
No draftable prompt detected. The input "make this better" lacks a target to
refine.

Did you mean:
- /mk:brainstorming — generate options for a vague problem
- /mk:office-hours — explore whether to build something at all

Re-run mk:prompt-enhancer with a draft prompt as input.
```

### HARD-FAIL conditions

- Skill produces a rewritten prompt anyway by inventing a target.
- Skill emits the 4-section output template with fabricated content.
- Skill silently treats the literal string "this" as a placeholder for
  unspecified content and fills in invented context.

### What CONSTITUTES a "draftable target"

Per the SKILL.md `When NOT to use` section, the input must be:
- An actual draft prompt (sentence(s) the user intends to send to an LLM), OR
- A prompt fragment with at least Goal or Context.

Pure improvement requests with no draft to operate on → refuse + redirect.
