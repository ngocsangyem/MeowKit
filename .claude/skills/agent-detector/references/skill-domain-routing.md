# Skill Domain Routing

> Loaded once per session by `mk:agent-detector` at Step 0b (sentinel-cached — read
> on turn 1, suppressed on turns 2..N of the same session). This table is skill
> dispatch only; it is NOT needed for agent/model-tier assignment, so it lives here
> rather than in always-loaded `.claude/rules/agent-routing.md`.

The orchestrator routes by skill names:

| Intent | Use |
| --- | --- |
| Quick codebase search or architecture fingerprint | `mk:scout` |
| Implementation pipeline | `mk:plan-creator` → `mk:cook` |
| Bug investigation / root cause | `mk:investigate` → `mk:fix` |
| Current library/API documentation | `mk:docs-finder` |
| Deep multi-source technical research with cited report (technology evaluation, ecosystem comparison, fact-finding) | `mk:research` — NOT for library/API doc lookup (`mk:docs-finder`) or project-only Q&A (`mk:ask-me`) |
| Project documentation updates | `mk:document-release` or `mk:docs-init` |
| Verification build/lint/test/typecheck | `mk:verify` or `mk:lint-and-validate` |
| Code review / pre-landing audit | `mk:review` |
| Review a GitHub PR (shallow verdict) / respond to received PR comments | `mk:review-pr` / `mk:respond-pr` |
| Browser or UI QA | `mk:qa`, `mk:qa-manual`, `mk:playwright-cli`, or `mk:agent-browser` |
| Visual explanation / diagrams / slides | `mk:preview` |
| Publish-grade SVG/PNG diagram for blog, doc, slide, or editorial use | `mk:tech-graph` |
| Mermaid v11 markdown diagram block (inline in docs or README) | `mk:mermaidjs-v11` |
| Diagram inside an HTML page or interactive presentation | `mk:preview --html --diagram` |
| Media or document analysis/generation | `mk:multimodal` |
| Security audit | `mk:cso` or `mk:vulnerability-scanner` |
| Skill creation | `mk:skill-creator` |
| AI-friendly docs index | `mk:llms` |
| One honest recommendation on a raw idea or decision, after the user's framing is challenged and confirmed | `mk:advise` — NOT for interrogation with no recommendation (`mk:grill`); NOT for enumerating alternatives to an already-validated problem (`mk:brainstorming`); NOT for "is this worth building at all" (`mk:office-hours`); NOT for multi-perspective deliberation (`mk:party`) |

| Long-form markdown reading in browser (RFCs, runbooks, plan files, design docs) | `mk:markdown-reader` — NOT for self-contained --html artifacts from mk:brainstorming or mk:plan-creator; those open directly in the browser without a server |
| Packaged shareable deliverable (demo page, social/portfolio HTML, topic showcase with optional screenshots) | `mk:showcase` — NOT for plan rendering (use mk:visual-plan); NOT for generic explain/diagram visuals (use mk:preview) |
| Generate a NEW UI design from a text prompt (no existing design source) | `mk:stitch` — NOT for implementing an existing design; use mk:figma (Figma URL) or mk:frontend-design (existing spec/mockup/DESIGN.md) for that |
| Implement an existing design (Figma URL, mockup, spec, or DESIGN.md) | `mk:figma` (Figma URL) or `mk:frontend-design` (spec/mockup) — NOT mk:stitch (Stitch generates novel designs from text, not from existing sources) |

Pick one primary skill per distinct intent.

If a task spans domains, run the workflow skill first (`mk:plan-creator`, `mk:cook`, `mk:fix`, or `mk:autobuild`) and load the domain skill at the phase where it is needed.
