# Scientific Method

Hypothesis → prediction → experiment → evidence → revise. The discipline that protects you from yourself. Your intuition generates hypotheses; the method tests them ruthlessly.

**Core principle:** Form hypotheses that could be proven false. Design experiments that could falsify them. Update beliefs on evidence, not preference.

## When to Use

- Debugging with systematic cause identification
- Performance investigation
- Feature experimentation / A-B tests
- Production incidents where you need rigor, not guesses
- Any investigation where "I think it's X" must earn the right to act

## Good Hypothesis Characteristics

- **Testable** — can design an experiment
- **Falsifiable** — can be proven wrong (if no result would disprove it, it's useless)
- **Specific** — not vague
- **Explanatory** — accounts for the observations

## Prediction Requirement

Predictions MUST differentiate hypothesis-true from hypothesis-false. If both outcomes produce the same observation, the prediction is useless. The value of the experiment is in what it _could_ falsify.

## Process

1. **Observe** — gather data. What's the pattern? When did it start? What's the scope?
2. **Question** — one central question, specific.
3. **Hypothesize** — testable, falsifiable, explanatory. Include _why_ you expect it (prior evidence).
4. **Predict** — "If true, I expect X. If false, I expect Y." Predictions must be different.
5. **Experiment** — design with control + treatment + metric + duration + success criteria. Control confounds.
6. **Analyze** — did the data SUPPORT or FALSIFY the hypothesis? State confidence (High/Medium/Low).
7. **Conclude & iterate** — act on supported hypothesis; re-hypothesize on falsified.

## Output Template (fits sequential-thinking)

```markdown
## Observation

[data, pattern, timeline, scope]

## Question

[one central question]

## Hypothesis

Statement + why you expect it (prior evidence).

## Predictions

If TRUE: [observation A]
If FALSE: [observation B — must differ from A]

## Experiment

Control / Treatment / Metric / Duration / Success criteria / Confounds controlled

## Results

[data]

## Verdict

SUPPORTED / FALSIFIED / INCONCLUSIVE — confidence level — reasoning.
```

## Example (compressed)

Bug: 5% of users see stale data. 4 hypotheses: (1) cache not invalidating, (2) read-replica lag, (3) browser caching, (4) CDN stale. Test in order of cheapness: CDN cache-status headers (fresh — ruled out) → force-refresh (stale persists — browser ruled out) → correlate report timestamps with replica-lag metrics (r=0.84 — SUPPORTED). Root: read-replica lag.

## Gotchas

- **Unfalsifiable hypothesis** — "the system is slow because of load." Not testable. Specify: "p99 latency rises above 500ms when concurrent requests exceed 200/sec."
- **Confirmation bias** — designing experiments that only confirm. Force yourself to write the FALSE-prediction first, then the TRUE-prediction.
- **Same prediction for both outcomes** — if true-case and false-case produce the same observable, the experiment has zero information value. Redesign.
- **Ignoring confounds** — running the treatment during a different traffic pattern than the control. Control variables deliberately.
- **Stopping at first "supported"** — one supportive experiment is evidence, not proof. Run adversarial variants before acting on high-impact changes.

## Bridge to sequential-thinking

Scientific Method formalizes what `meow:sequential-thinking` does informally. Use this reference when investigation rigor matters: production incidents, user-facing bugs, A/B experimentation. The hypothesis table in `hypothesis-testing.md` is the experimental log; this reference is the discipline behind filling it out.
