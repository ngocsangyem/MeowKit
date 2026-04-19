# BDD → Acceptance Criteria Mapping

How to translate Gherkin BDD scenarios from a product spec into testable acceptance criteria for a sprint contract. Sourced from research-02 (sprint contract patterns) and adapted for the harness.

## The Translation Step

A product-level spec (Phase 1 mode) describes features in user-story form:

> As a designer, I want to fill a region of tiles with one click, so that I can paint backgrounds quickly.

This is **not testable as written**. The contract translates it into criteria the evaluator can probe via active verification.

## BDD Form (Gherkin)

```gherkin
Feature: Region fill
  As a designer
  I want to fill a region of tiles with one click
  So that I can paint backgrounds quickly

  Scenario: Rectangle drag fills tiles
    Given the level editor is open with the rectangle-fill tool selected
    And the user has selected tile T-04 from the palette
    When the user drags from grid coordinate (10,10) to (50,50)
    Then all tiles in that rectangular region show texture T-04
    And the action appears in the undo history
```

## Sprint Contract AC (this form)

```markdown
### [AC-01] Rectangle drag fills tiles with selected tile

**Given** the level editor is open with the rectangle-fill tool selected and tile T-04 picked from the palette
**When** the user drags from grid coordinate (10,10) to (50,50)
**Then** all tiles in that rectangular region show texture T-04 AND the action appears in the undo history

- **Verification:** Playwright drag action from coord (10,10) to (50,50); DOM inspection of tile elements in the region; check undo-history popover for the new entry
- **Rubric tie-in:** functionality (weight 0.30)
```

## The Translation Rules

1. **Collapse multi-step Givens into one Given line.** BDD spreads preconditions across multiple `Given/And` lines; the AC form collects them into a single Given for readability.
2. **Collapse multi-assertion Thens.** Same as Givens — the AC's Then captures all observable outcomes, joined with AND.
3. **Add a Verification line.** BDD assumes a test runner that maps step definitions to code; this kit's evaluator drives the build directly. The Verification line tells the evaluator how to probe the criterion (browser, curl, CLI, or a combination).
4. **Add a Rubric tie-in.** BDD tests are atomic; AC criteria are graded against weighted rubrics. The tie-in line says which rubric this AC contributes to and what weight applies.
5. **Drop "Feature: ... As a ... I want ... So that ..." preamble.** The product-level plan already has the user story. The AC focuses on the testable mechanic.
6. **Be specific about coordinates / values / data.** BDD often uses `<placeholders>`; AC uses real values the evaluator can paste into a probe.

## Anti-patterns

| Bad AC | Why | Fix |
|---|---|---|
| "User can fill regions efficiently" | Untestable — no observable outcome | Specify keystrokes/mouse actions and the expected DOM/state result |
| "Rectangle drag works correctly" | Vague — "correctly" is opinion | Specify the exact pre/post state and tools used to verify |
| "All tiles fill on drag" | Missing precondition | Add Given clauses for tool selection and palette state |
| Given/When/Then with multi-step verification but no Verification line | Evaluator has no probe instructions | Add explicit Verification line with tool names |
| AC with no rubric tie-in | Evaluator can't score it | Bind to one preset rubric |

## Worked Example: User Story → 3 ACs

**Product spec user story:**
> As a returning user, I want my last 10 prompts saved so I can pick up where I left off.

**Translation into ACs:**

```markdown
### [AC-04] Prompt history persists across sessions

**Given** the user has previously submitted at least 5 prompts in a prior session
**When** the user opens the app in a new browser tab (cold load, no cookies cleared)
**Then** the prompt history panel displays the 5 prompts in reverse-chronological order

- **Verification:** Playwright: open page → submit 5 prompts → close tab → reopen → assert history list contains 5 items
- **Rubric tie-in:** product-depth (weight 0.30)

### [AC-05] Prompt history caps at 10 entries

**Given** the prompt history already contains 10 entries
**When** the user submits an 11th prompt
**Then** the oldest entry is removed AND the new entry appears at the top of the list

- **Verification:** Playwright: pre-seed 10 prompts via DB or repeated submit → submit 11th → assert list still has 10 entries with new one first
- **Rubric tie-in:** product-depth (weight 0.30)

### [AC-06] Prompt history is private per user

**Given** two users are signed in to different accounts
**When** user A views their prompt history
**Then** user B's prompts are NOT visible AND no API call leaks user B's data

- **Verification:** Playwright: sign in as A → submit prompts → sign out → sign in as B → check history (empty) → inspect Network tab for data leak
- **Rubric tie-in:** functionality (weight 0.30)
```

One user story → three ACs. Each is independently testable. Each binds to a rubric. The evaluator can probe each via the cited Verification technique.

## When to Skip BDD-style Givens

For purely behavioral criteria with no precondition (e.g., "page loads under 2s"), the Given/When/Then form feels stilted. In that case, use the explicit assertion form:

```markdown
### [AC-07] Landing page first contentful paint ≤ 2s

- **Assertion:** `meow:browse <url>` reports `firstContentfulPaint <= 2000`
- **Verification:** browser DevTools timing API; capture and assert
- **Rubric tie-in:** craft (weight 0.05)
```

The validator accepts EITHER form (Given/When/Then triplet OR explicit Assertion).

## References

- research-02 (Contract Net Protocol + BDD alignment)
- Anthropic harness research on testable criteria translation
- Cucumber/Gherkin: https://cucumber.io/docs/gherkin/ (background only — this kit does NOT use Cucumber runtime)
