# Edge Case Discovery

Process for finding where the textbook approach fails — and documenting the correct response.

---

## Why Edge Cases Matter

Edge cases are not rare exceptions to handle later. They are the cases where the standard
framework gives the wrong answer. Documenting them upfront prevents recurring escalations,
inconsistent decisions, and expert knowledge locked in one person's head.

---

## Discovery Process

### Step 1: Ask "Where Does the Textbook Approach Fail?"

For each case type in the taxonomy, ask the domain expert:
> "Walk me through a case where following the standard rule would give the wrong outcome."

Probe with:
- "What's the one case that always gets escalated, even though it looks routine?"
- "What case do new team members always get wrong?"
- "What case did we get wrong last quarter?"

### Step 2: Collect From the Team

Run a structured team session (15 min max):
1. Each person writes one edge case on a card/sticky: "We had a case where X, and the obvious answer was wrong."
2. Group by case type from the taxonomy.
3. For each group: vote on the top 2 most likely to recur.

Focus on **recurrence** and **cost of getting it wrong**, not novelty.

### Step 3: Document Each Edge Case

For every confirmed edge case, write a 2-3 sentence playbook entry:

```
**[Edge Case Name]**
Situation: [What the case looks like — enough detail to recognize it]
Why obvious approach fails: [The specific reason the standard rule produces the wrong outcome]
Correct approach: [What to do instead, and why it works here]
```

---

## Edge Case Playbook Format

Collect all entries in a single section per case type. Example structure:

### [Case Type A] Edge Cases

**[Edge Case Name 1]**
Situation: [description]
Why obvious approach fails: [reason]
Correct approach: [action]

**[Edge Case Name 2]**
Situation: [description]
Why obvious approach fails: [reason]
Correct approach: [action]

---

## Maintenance

- Review edge case playbook quarterly or after any significant decision failure.
- Add new entries immediately after a case causes an unexpected escalation.
- Mark entries as "resolved" if a taxonomy or rule change eliminates the ambiguity.
- Never delete edge cases — archive them with a note explaining the taxonomy change.

---

## Warning Signs You're Missing Edge Cases

- Every case fits cleanly into the taxonomy on the first attempt.
- No cases have been escalated in the past 90 days.
- Domain expert says "it's pretty straightforward."

These are signals to probe harder, not confirmation that edge cases don't exist.
