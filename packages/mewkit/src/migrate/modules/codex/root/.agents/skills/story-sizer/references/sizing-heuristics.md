# Sizing Heuristics

Maps a `StoryRecord` to a Fibonacci point estimate, complexity verdict, inconsistency flags, optional split proposal, and (when the Agile rules are loaded) a DoR advisory. Reuses Fibonacci anchors from `.agents/skills/jira/references/estimation-guide.md` — DO NOT drift from that table.

## Inputs / Outputs

```text
in:  StoryRecord (per references/input-adapter.md)
     optional: scout_context (codebase signals from the scout skill)
     optional: agile_loaded (bool — true when agile-story-gates.md loaded)

out: SizedRecord {
       points: 1|2|3|5|8|13|null    # null = REFUSED
       uncertainty: "±N"             # symmetric Fibonacci-step uncertainty
       complexity: "low"|"medium"|"high"|"very-high"
       drivers_score: int            # sum of dimension scores (0..15)
       inconsistencies: string[]
       split_proposal: SplitProposal | null
       codebase_signals: CodebaseSignals | null
       dor_status: DoRStatus | null
       refusal_reason: string | null
     }
```

A record with the `[NO_ACS]` flag is REFUSED — `points: null`, `refusal_reason: "missing acceptance criteria"`. The skill never sizes ACs-less stories.

## Complexity Dimensions (deterministic scoring)

Each dimension scores 0..3. Sum is the `drivers_score`.

| Dimension | Score 0 | Score 1 | Score 2 | Score 3 |
|-----------|---------|---------|---------|---------|
| **AC count** | 0 (refuse) | 1–2 ACs | 3–4 ACs | 5+ ACs |
| **Integration breadth** | none | 1 internal-only verb match (`update`, `fetch`, `read`) | 1 external-system match (`oauth`, `webhook`, `stripe`, `api`, `email`, `s3`, `sso`) | 2+ external-system matches |
| **Novelty** | matches existing scout pattern | minor adaptation | new pattern in known area | net-new technology / pattern |
| **Code-volume estimate** | <20 LoC implied | 20–80 LoC | 80–200 LoC | 200+ LoC |
| **Cross-module breadth** | 1 area implied | 2 areas | 3 areas | 4+ areas |

### Verb / keyword inventories

- **External-system verbs** (case-insensitive substring, applied to title + description + ACs):
  `oauth`, `saml`, `sso`, `webhook`, `stripe`, `paypal`, `sepay`, `twilio`, `sendgrid`, `s3`, `gcs`, `kms`, `cognito`, `okta`, `google`, `apple`, `facebook`, `api`, `email`, `sms`, `push notification`
- **Internal verbs**: `fetch`, `read`, `query`, `update`, `display`, `render`, `validate`, `compute`, `transform`
- **Risk verbs** (bump 1 dimension score by +1 when matched):
  `migrate`, `refactor`, `rewrite`, `breaking`, `deprecate`, `replace`

### Code-volume heuristic

Sum of AC verb-counts and noun-counts is a crude proxy:

```text
volume_index = 2 * (count of AC items) + (count of nouns in description, capped at 20)
score 0:  volume_index < 6
score 1:  6 ≤ volume_index < 14
score 2:  14 ≤ volume_index < 22
score 3:  volume_index ≥ 22
```

Nouns approximated by `\b[A-Z][a-z]+\b` matches (proper nouns) plus dictionary-free word counting; the implementation favors **stability** (same input → same output) over linguistic accuracy.

### Cross-module breadth

Counted as the number of distinct "area markers" found in description + ACs:

`auth`, `billing`, `notification`, `profile`, `dashboard`, `search`, `report`, `admin`, `settings`, `onboarding`, `checkout`, `cart`.

## Fibonacci Mapping

```text
drivers_score 0..3        → 1 point (low)        uncertainty ±0
drivers_score 4..5        → 2 points (low)       uncertainty ±1
drivers_score 6..7        → 3 points (medium)    uncertainty ±1
drivers_score 8..9        → 5 points (medium)    uncertainty ±2
drivers_score 10..11      → 8 points (high)      uncertainty ±3
drivers_score 12..15      → 13 points (very-high) uncertainty ±5   → SPLIT SUGGESTED
```

When `drivers_score ≥ 10` AND `distinct_concerns > 2`, also raise SPLIT.

## Inconsistency Detection

Flag any of the following:

1. **AC ↔ AC contradictions** — two ACs differ only in a single destination/route/state value (heuristic: pairs with Levenshtein ratio ≥ 0.7 AND a token-level difference of exactly 1 noun).
2. **Description ↔ AC mismatch** — description references a feature keyword (e.g. `oauth`) that appears in no AC.
3. **Concern bloat** — distinct area-markers > 2 → "story mixes N concerns: {list}".
4. **Risk verb in description, no risk-mitigation AC** — flag advisory only (not a refusal).

Each flagged inconsistency is appended to `inconsistencies[]` as a short human-readable string.

## Split Proposal

Triggered when:

- `points ≥ 13` OR `distinct_concerns > 2` OR `uncertainty step > ±3`

Output shape:

```text
SplitProposal {
  trigger: "size"|"concerns"|"uncertainty"
  sub_stories: [
    { title, focus, est_points }   # 2–3 entries, each sized via this same heuristic on a synthetic StoryRecord
  ]
  rationale: string
}
```

Splits are **advisory only**. The sized parent record stays in the report; the split is appended below it for the dev to decide.

## DoR Advisory (conditional)

If `agile_loaded == true` (i.e., the agile story gates rule was loaded by `mk:agent-detector`), emit a `DoRStatus`:

```text
DoRStatus {
  has_user_phrase: bool          # "as a … I want …"
  has_benefit_phrase: bool       # "so that …"
  testable_acs: bool             # every AC has a binary observable
  dependencies_named: bool       # description or ACs reference upstream tickets / external deps
  verdict: "ready"|"not-ready"
  reasons: string[]
}
```

If `agile_loaded == false`, omit the field silently.

## Determinism

- Same `StoryRecord` produces the same `SizedRecord` on every run — math is integer arithmetic over text-derived counts.
- Reasoning text in the report may vary across runs; the numbers do not.
- Test coverage in `tests/story-sizer-heuristics.test.sh` asserts identical numeric output across replays.

## Refusal Path

Inputs that refuse sizing (return `points: null`):

- Record flagged `[NO_ACS]` from the adapter.
- All ACs are duplicates of each other (treated as a single AC; score 0 on AC-count → refuse).
- `drivers_score == 0` AND `distinct_concerns == 0` — i.e., empty signal — refuse with `refusal_reason: "no signal"` rather than emitting a 1-point estimate.

## Cross-references

- Fibonacci anchors: `.agents/skills/jira/references/estimation-guide.md`
- Trust boundary: `AGENTS.md` (Data & injection boundary) Rule 1 + Rule 11
- Optional DoR rules: agile story gates (advisory, DoR-only)
- Scout extraction (when `--scout` is passed): mirrors `mk:planning-engine` (see SKILL.md)
