# Fix-First Review (Step 5)

**Every finding gets action — not just critical ones.**

Output a summary header: `Pre-Landing Review: N issues (X critical, Y informational)`

## Step 5a: Classify each finding

For each finding, classify as AUTO-FIX or ASK per the Fix-First Heuristic in
checklist.md. Critical findings lean toward ASK; informational findings lean
toward AUTO-FIX.

## Step 5b: Auto-fix all AUTO-FIX items

Apply each fix directly. For each one, output a one-line summary:
`[AUTO-FIXED] [file:line] Problem -> what you did`

## Step 5c: Batch-ask about ASK items

If there are ASK items remaining, present them in ONE AskUserQuestion:

- List each item with a number, the severity label, the problem, and a recommended fix
- For each item, provide options: A) Fix as recommended, B) Skip
- Include an overall RECOMMENDATION

Example format:
```
I auto-fixed 5 issues. 2 need your input:

1. [CRITICAL] app/models/post.rb:42 — Race condition in status transition
   Fix: Add `WHERE status = 'draft'` to the UPDATE
   -> A) Fix  B) Skip

2. [INFORMATIONAL] app/services/generator.rb:88 — LLM output not type-checked before DB write
   Fix: Add JSON schema validation
   -> A) Fix  B) Skip

RECOMMENDATION: Fix both — #1 is a real race condition, #2 prevents silent data corruption.
```

If 3 or fewer ASK items, you may use individual AskUserQuestion calls instead of batching.

## Step 5d: Apply user-approved fixes

Apply fixes for items where the user chose "Fix." Output what was fixed.

If no ASK items exist (everything was AUTO-FIX), skip the question entirely.

## Verification of claims

Before producing the final review output:
- If you claim "this pattern is safe" -> cite the specific line proving safety
- If you claim "this is handled elsewhere" -> read and cite the handling code
- If you claim "tests cover this" -> name the test file and method
- Never say "likely handled" or "probably tested" — verify or flag as unknown

**Rationalization prevention:** "This looks fine" is not a finding. Either cite evidence it IS fine, or flag it as unverified.

## External PR comment resolution (if applicable)

If the PR has review comments from GitHub reviewers or CI bots:

1. **VALID & ACTIONABLE comments:** Include in your findings — follow Fix-First flow (auto-fix if mechanical, batch into ASK if not). Log resolution to `.claude/memory/reviews.jsonl`.

2. **FALSE POSITIVE comments:** Present each via AskUserQuestion with evidence for why it's incorrect. Options: A) Dismiss with explanation, B) Fix anyway, C) Ignore.

3. **ALREADY ADDRESSED comments:** Note what was done and the fixing commit SHA. Log to `.claude/memory/reviews.jsonl`.
