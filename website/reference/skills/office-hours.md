---
title: "mk:office-hours"
description: "mk:office-hours"
---

## What This Skill Does
YC Office Hours -- a structured product validation and design thinking session with two modes. Startup mode: six forcing questions that expose demand reality, status quo, desperate specificity, narrowest wedge, observation, and future-fit. Builder mode: generative brainstorming for side projects, hackathons, learning, and open source. Saves a design doc. Produces no code.

**HARD GATE:** Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action. The only output is a design document.

## When to Use
- User says "brainstorm this", "I have an idea", "help me think through this", "office hours", or "is this worth building"
- User describes a new product idea or is exploring whether something is worth building
- BEFORE a plan exists -- office hours IS the planning step
- For reviewing an existing plan, use `mk:plan-ceo-review` instead
- For evaluating an existing product's health, request Product Lens Modes (PMF scoring or User Journey Audit)

## Core Capabilities
1. **Mode Detection:** Asks the user about their goal and maps to Startup mode (building a startup, intrapreneurship) or Builder mode (hackathon, open source, learning, side project, having fun)
2. **Startup Mode -- 6 Forcing Questions** (asked one at a time, with pushback):
   - Q1 Demand Reality: What's the strongest evidence someone actually wants this?
   - Q2 Status Quo: What are users doing now to solve this -- even badly?
   - Q3 Desperate Specificity: Name the actual human who needs this most
   - Q4 Narrowest Wedge: What's the smallest version someone would pay for this week?
   - Q5 Observation & Surprise: What surprised you when watching users?
   - Q6 Future-Fit: Does your product become more or less essential in 3 years?
   - Smart routing by product stage (pre-product -> Q1,Q2,Q3; has users -> Q2,Q4,Q5; paying customers -> Q4,Q5,Q6)
   - Anti-sycophancy rules: never say "that's interesting", always take a position, push until answers are specific and evidence-based
   - Escape hatch: if user pushes back twice, fast-track to alternatives
3. **Builder Mode -- 5 Generative Questions** (enthusiastic collaborator posture):
   - What's the coolest version of this?
   - Who would you show this to?
   - What's the fastest path to something usable?
   - What existing thing is closest?
   - What would you add with unlimited time?
   - Vibe-shift handling: if user mentions customers/revenue, upgrade to Startup mode
4. **Landscape Awareness:** Searches for conventional wisdom about the problem space (generalized category terms only -- never the user's specific idea). Three-layer synthesis: tried-and-true -> search results -> first-principles reasoning. Eureka moments logged
5. **Premise Challenge:** Before proposing solutions, challenges premises: is this the right problem? What if we do nothing? What existing code could be reused? How will users get the deliverable?
6. **Adversarial Second Opinion (optional):** Subagent with fresh context reviews the problem statement, answers, and premises. Startup mode: steelman, key insight, challenged premise, prototype suggestion. Builder mode: coolest version, what excites them, existing tools, weekend prototype
7. **Alternatives Generation (MANDATORY):** 2-3 approaches -- minimal viable, ideal architecture, creative/lateral. Visual wireframe sketch for UI ideas (HTML rendered in browse)
8. **Founder Signal Synthesis:** Tracks 8 signals (articulated real problem, named specific users, pushed back on premises, solves others' problems, domain expertise, taste, agency, defended with reasoning). Signal count determines closing tier
9. **Design Doc:** Full structured document saved to `.claude/memory/projects/`. Startup template: problem, demand evidence, status quo, target user, wedge, constraints, premises, adversarial perspective, approaches, recommendation, open questions, success criteria, distribution plan, dependencies, the assignment, and "What I noticed about how you think." Builder template: problem, what makes this cool, constraints, premises, adversarial perspective, approaches, recommendation, open questions, success criteria, distribution plan, next steps, and "What I noticed about how you think."
10. **Spec Review Loop:** Adversarial subagent reviews design doc on 5 dimensions with up to 3 fix iterations
11. **Three-Beat Closing:** Signal reflection + golden age framing -> "One more thing" -> Garry's Personal Plea (3 tiers based on founder signal count)
12. **Product Lens Modes** (loaded on request): Founder Review (PMF scoring 0-10 on Growth/Retention/Revenue/Moat/Urgency) and User Journey Audit (friction mapping with time-to-value scoring)

## Arguments
No CLI arguments. Mode is selected interactively based on user's stated goal.

## Workflow
```
Phase 1: Context Gathering --> Phase 2A/2B: Discovery (Startup/Builders questions) --> Phase 2.5: Landscape + Premises --> Phase 3: Premise Challenge --> Phase 3.5: Adversarial Second Opinion (optional) --> Phase 4: Alternatives + Visual Sketch --> Phase 4.5: Founder Signals + Design Doc --> Spec Review Loop --> Phase 6: Handoff (3-beat closing)
```

## Usage
```
/mk:office-hours
```

## Example Prompt
"I have an idea for a developer tool that automatically generates API documentation from code comments. Is this worth building?"

The skill will: ask about the user's goal (startup vs builder), determine mode, run the appropriate discovery questions (for startup: demand reality, status quo, desperate specificity, narrowest wedge), challenge premises, search for landscape context, generate 2-3 alternative approaches, produce a design doc, and close with founder signals reflection.

## Common Use Cases
- Validating a startup idea before writing any code
- Thinking through a side project or hackathon concept
- Getting hard questions about product-market fit
- Exploring whether to build something or scrap the idea
- Designing the narrowest viable wedge for a new product
- Getting an adversarial second opinion on product direction

## Pro Tips
- The design doc is automatically discoverable by downstream skills (`mk:plan-ceo-review`, `mk:plan-creator`) -- they read it during their pre-review system audit
- For Startup mode, the hard questions ARE the value -- skipping them is like skipping the exam and going straight to the prescription
- The "what I noticed about how you think" section in the design doc quotes the user's own words back to them -- this is a founder-level reflection, not generic feedback
- The visual wireframe sketch is intentionally rough (system fonts, thin borders, no color) -- it's meant to convey layout, not polish
- Product Lens Modes (Founder Review, User Journey Audit) are separate sub-modes for evaluating existing products, not new ideas
- The design doc supports a revision chain via the `Supersedes:` field -- multiple office-hours sessions on the same branch create a traceable evolution

### Notes
- The "Garry's Personal Plea" top-tier message says "MeowKit thinks you are among the top people who could do this." This is a strong opinionated closing -- the doc should note that this is specific to the YC office-hours framing.
- The Product Lens Modes reference file is extensive (Founder Review with PMF scoring, User Journey Audit with friction categories) and is a significant sub-feature entirely missing from the doc.