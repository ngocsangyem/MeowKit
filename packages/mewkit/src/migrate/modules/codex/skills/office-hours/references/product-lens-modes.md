# Product Lens Modes

Two structured diagnostic modes for evaluating an existing product. Load this reference when the user asks about product health, PMF, or user retention — not for new ideas (those use the standard office-hours startup/builder modes).

## Mode Selection

| User Question | Mode |
|---|---|
| "Should I keep building this?" / "Is this worth continuing?" | Founder Review |
| "Why aren't users sticking around?" / "Why is retention bad?" | User Journey Audit |
| "Is this working?" / "How healthy is the product?" | Founder Review |
| "What's the onboarding problem?" / "Why do users drop off?" | User Journey Audit |

---

## Founder Review

A rapid product-market fit diagnostic. Takes 30-60 minutes. Produces a PMF score and a prioritized action list.

### Inputs to Gather First

Read these before asking the user any questions:
- `README.md` — what the product claims to be
- `CLAUDE.md` or `docs/project-context.md` — how it's built
- `package.json` / equivalent — tech stack and dependencies
- Recent git commits (last 20) — what's been worked on lately
- Any existing analytics, metrics, or user feedback the user can share

### PMF Score (0-10)

Score the product on each dimension (0-2 each), sum for total:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **Growth** | No new users | Some organic or paid | Clear growth signal |
| **Retention** | Most users churn in week 1 | Mixed retention | Users return regularly |
| **Revenue** | No revenue signal | Some paying users | Revenue growing |
| **Moat** | Easily replicated | Some switching cost | Strong defensibility |
| **Urgency** | Nice to have | Moderately important | Users would be very disappointed if it went away |

Score interpretation:
- 0-3: Pre-PMF. Major pivot or kill decision needed.
- 4-6: Weak PMF. Signals exist but not strong enough to scale.
- 7-8: PMF emerging. Double down on what's working.
- 9-10: Strong PMF. Scale aggressively.

### 10x Opportunity

Identify: what is the one thing this product could do that would make it 10x more valuable to its best users? Not a feature list — one insight.

### Flag What Doesn't Matter

List 2-3 things the team is working on that have no PMF relevance. These should be deprioritized or cut.

---

## User Journey Audit

A friction-mapping exercise. Walk through the product as a new user. Time every step. Find where value is lost.

### Process

1. **Start fresh** — use a new browser profile, no cookies, no prior session. Simulate a new user arriving for the first time.
2. **Document each step** — screenshot, time (in seconds), and friction notes
3. **Time-to-value** — record exactly when the user experiences the core value for the first time. This is the most important number.
4. **Score time-to-value:**
   - <60 seconds: Excellent
   - 1-5 minutes: Good
   - 5-15 minutes: Needs work
   - >15 minutes: Critical problem

### Friction Point Categories

For each friction point found, categorize it:
- **Comprehension friction** — user doesn't understand what to do
- **Effort friction** — user understands but the step is too much work
- **Trust friction** — user hesitates because they're unsure it's safe or worth it
- **Technical friction** — error, slow load, broken interaction

### Top 3 Onboarding Fixes

After the audit, output exactly 3 fixes in priority order. Each fix must:
- Address a specific friction point (named and categorized above)
- Be implementable in <1 week
- Have a measurable expected improvement (e.g., "reduces time-to-value from 8min to 3min")
