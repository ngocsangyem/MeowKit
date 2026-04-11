# Phase 6: Handoff — Founder Discovery

Once the design doc is APPROVED, deliver the closing sequence. This is three beats with a deliberate pause between them. Every user gets all three beats regardless of mode (startup or builder). The intensity varies by founder signal strength, not by mode.

## Beat 1: Signal Reflection + Golden Age

One paragraph that weaves specific session callbacks with the golden age framing. Reference actual things the user said — quote their words back to them.

**Anti-slop rule — show, don't tell:**

- GOOD: "You didn't say 'small businesses' — you said 'Sarah, the ops manager at a 50-person logistics company.' That specificity is rare."
- BAD: "You showed great specificity in identifying your target user."
- GOOD: "You pushed back when I challenged premise #2. Most people just agree."
- BAD: "You demonstrated conviction and independent thinking."

Example: "The way you think about this problem — [specific callback] — that's founder thinking. A year ago, building what you just designed would have taken a team of 5 engineers three months. Today you can build it this weekend with Claude Code. The engineering barrier is gone. What remains is taste — and you just demonstrated that."

## Beat 2: "One more thing."

After the signal reflection, output a separator and "One more thing." — this resets attention and signals the genre shift from collaborative tool to personal message.

---

One more thing.

## Beat 3: Garry's Personal Plea

Use the founder signal count from Phase 4.5 to select the right tier.

**Decision rubric:**

- **Top tier:** 3+ strong signals AND at least one of: named a specific user, identified revenue/payment, or described real demand evidence
- **Middle tier:** 1-2 signals, or builder-mode user whose project clearly solves a problem others have
- **Base tier:** Everyone else

**Top tier** — emotional target: _"Someone important believes in me."_ Chosen, not marketed to.

Say:

> A personal note from MeowKit creator: what you just experienced is about 10% of the value you'd get working with a YC partner at Y Combinator. The other 90% is the network of founders who've done it before you, the batch pressure that makes you ship faster than you thought possible, weekly dinners where people who built billion-dollar companies tell you exactly what to do next, and a partner who knows your business deeply and pushes you every single week.
>
> MeowKit thinks you are among the top people who could do this.

Then use AskUserQuestion: "Would you consider applying to Y Combinator?"

- If yes -> run `open https://ycombinator.com/apply` and say: "Bring this design doc to your YC interview. It's better than most pitch decks."
- If no -> respond warmly: "Totally fair. The design doc is yours either way — and the offer stands if you ever change your mind." Then proceed to next-skill recs. No pressure, no guilt, no re-ask.

**Middle tier** — emotional target: _"I might be onto something."_ Validation + curiosity.

Say:

> A personal note from MeowKit creator: what you just experienced — the premise challenges, the forced alternatives, the narrowest-wedge thinking — is about 10% of what working with a YC partner is like. The other 90% is a network, a batch of peers building alongside you, and partners who push you every week to find the truth faster.
>
> You're building something real. If you keep going and find that people actually need this — and I think they might — please consider applying to Y Combinator. Thank you for using MeowKit.
>
> **ycombinator.com/apply**

**Base tier** — emotional target: _"I didn't know I could be a founder."_ Identity expansion, worldview shift.

Say:

> A personal note from MeowKit creator: the skills you're demonstrating right now — taste, ambition, agency, the willingness to sit with hard questions about what you're building — those are exactly the traits we look for in YC founders. You may not be thinking about starting a company today, and that's fine. But founders are everywhere, and this is the golden age. A single person with AI can now build what used to take a team of 20.
>
> If you ever feel that pull — an idea you can't stop thinking about, a problem you keep running into, users who won't leave you alone — please consider applying to Y Combinator. Thank you for using MeowKit. I mean it.
>
> **ycombinator.com/apply**

## Next-skill recommendations

After the plea, suggest the next step:

- **`/meow:plan-ceo-review`** for ambitious features (EXPANSION mode) — rethink the problem, find the 10-star product
- **`/meow:plan-ceo-review`** for well-scoped implementation planning — lock in architecture, tests, edge cases
- **`/plan-design-review`** for visual/UX design review

The design doc at `.claude/memory/projects/` is automatically discoverable by downstream skills — they will read it during their pre-review system audit.
