# MeowKit Documentation

Documentation for the MeowKit prompt-engineering framework — an outer harness for multi-agent orchestration, context engineering, and workflow automation.

---

## Directory Map

### Root — Essential References

Documents that are loaded at runtime, enforced by CI, or serve as the primary entry points for understanding MeowKit.

| File | Purpose | Audience |
|------|---------|----------|
| [`meowkit-architecture.md`](meowkit-architecture.md) | Ground-truth system model with verified source citations | Architects |
| [`meowkit-system-flow.md`](meowkit-system-flow.md) | End-to-end lifecycle synthesis (injection → phases → feedback) | Onboarders |
| [`meowkit-rules.md`](meowkit-rules.md) | Contribution rulebook enforced at review/merge | All contributors |
| [`project-context.md`](project-context.md) | Agent constitution loaded at SessionStart | Every agent |
| [`memory-system.md`](memory-system.md) | Per-project memory persistence at `.claude/memory/` | Skill authors |
| [`branding-style-guide.md`](branding-style-guide.md) | Brand/neutral-term governance for `.claude/` prose | Contributors |
| [`dead-weight-audit.md`](dead-weight-audit.md) | Playbook for pruning obsolete harness assumptions | Maintainers |
| [`skills-documentation-audit-20260502.md`](skills-documentation-audit-20260502.md) | Audit of 9 `mk:` skills (2026-05-02) | Doc maintainers |

### [`architecture/`](architecture/) — How MeowKit Is Built

Component design, context boundaries, skill ecosystem maps, and formal architecture decisions.

| File | Purpose |
|------|---------|
| [`context-isolation.md`](architecture/context-isolation.md) | Context flow, isolation boundaries, injection points |
| [`system-architecture.md`](architecture/system-architecture.md) | orchviz write surface, context boundary, rules layout |
| [`trigger-registry.md`](architecture/trigger-registry.md) | Canonical skill/hook/rubric trigger catalog |
| [`adr/`](architecture/adr/) | Architecture Decision Records |
| [`diagrams/`](architecture/diagrams/) | System diagrams (PNG) |

### [`governance/`](governance/) — How MeowKit Is Governed

Rules, rationale, indexes, and authoring guides. These define how contributors write code, rules, skills, and agents.

| File | Purpose |
|------|---------|
| [`meowkit-agent-rules.md`](governance/meowkit-agent-rules.md) | Human-readable agent conduct guide |
| [`rules-index.md`](governance/rules-index.md) | Complete rule catalog with enforcement matrix |
| [`rule-rationale.md`](governance/rule-rationale.md) | Preserved "why" behind trimmed rules |
| [`skill-authoring-guidelines.md`](governance/skill-authoring-guidelines.md) | MeowKit-specific skill authoring guide |

### [`operations/`](operations/) — How to Use MeowKit

End-user guides, workflow routing, and operational runbooks.

| File | Purpose |
|------|---------|
| [`harness-runbook.md`](operations/harness-runbook.md) | Guide to `/mk:harness` autonomous build pipeline |
| [`business-workflow-patterns.md`](operations/business-workflow-patterns.md) | Trigger-to-skill routing for business tasks |
| [`red-team-overview.md`](operations/red-team-overview.md) | Adversarial code review pipeline spec |

### [`design/`](design/) — How MeowKit Looks

Visual identity, design tokens, and CSS implementation.

| File | Purpose |
|------|---------|
| [`meowkit-design-guideline.md`](design/meowkit-design-guideline.md) | Logo, colors, typography, icon system |
| [`design-tokens.json`](design/design-tokens.json) | Machine-readable dark-theme tokens |
| [`meowkit-tokens.css`](design/meowkit-tokens.css) | CSS custom properties and utility classes |

### [`reference/`](reference/) — Foundational External Knowledge

Canonical references that define the intellectual foundation of harness engineering. These are not MeowKit-specific but inform its design.

| File | Source | Topic |
|------|--------|-------|
| [`the-harness-is-everything.md`](reference/the-harness-is-everything.md) | External | Central thesis: harness > model |
| [`what-is-harness-engineering.md`](reference/what-is-harness-engineering.md) | External | Landscape: Prompt → Context → Harness evolution |
| [`architectural-foundations-of-harness-engineering.md`](reference/architectural-foundations-of-harness-engineering.md) | External | 7-layer model, 23-layer validation gates |
| [`agents-isolate.md`](reference/agents-isolate.md) | External | Isolate pattern for sub-agent context windows |
| [`context-engineering-for-autonomous-agents.md`](reference/context-engineering-for-autonomous-agents.md) | External | CE patterns: observation budget, scratchpad, compression |
| [`effective-context-engineering-for-ai-agents.md`](reference/effective-context-engineering-for-ai-agents.md) | Anthropic | Official CE philosophy |
| [`harness-design-long-running-apps.md`](reference/harness-design-long-running-apps.md) | Anthropic Labs | Generator-evaluator loop case study |
| [`claude-memory.md`](reference/claude-memory.md) | Anthropic | Official CLAUDE.md/auto-memory docs |
| [`claude-prompting-best-practices.md`](reference/claude-prompting-best-practices.md) | Anthropic | Official prompt engineering guide |
| [`codex-prompt-guide.md`](reference/codex-prompt-guide.md) | OpenAI | Official Codex prompting guide |
| [`sub-agents.md`](reference/sub-agents.md) | Anthropic | Official sub-agent configuration spec |
| [`skill-authoring-best-practices.md`](reference/skill-authoring-best-practices.md) | Anthropic | Authoritative skill authoring reference |
| [`lessons-build-skill.md`](reference/lessons-build-skill.md) | Anthropic | Internal skill-building field report |

### [`research/`](research/) — Active Investigation

Ongoing research, competitive analysis, deferred feature planning, and vendor-specific references.

| File | Topic |
|------|-------|
| `agent-prompt-dream-memory-consolidation.md` | Claude Code Dream memory consolidation prompt |
| `auto-dream-reference.md` | Reverse-engineered Auto Dream spec (deferred `mk:dream`) |
| `claude-cowork-prompt-injection.md` | Prompt injection defense guide |
| `context-engineering-guide.md` | Encyclopedia of context engineering techniques |
| `gemini-prompting-best-practices.md` | Google Gemini 3 API prompting guide |
| `improving-deep-agents-with-harness-engineering.md` | LangChain harness improvement methodology |
| `prompt-crafting.md` | Factory.ai model-specific prompt techniques |
| `prompt-injection-defenses.md` | Anthropic browser-agent injection defenses |
| [`factoryai/`](research/factoryai/) | Factory.ai reference implementations (5 files) |

### [`archive/`](archive/) — Obsolete & Redundant

Files that are known-obsolete or duplicate. Preserved for historical reference only.

| File | Reason |
|------|--------|
| `codex_prompting_guide.md` | Duplicate of `reference/codex-prompt-guide.md` |
| `what-is-claude-code-autodream-memory-consolidation-2.md` | Feature confirmed non-existent |

---

## Quick Reference: Where to Find X

| Question | Look in |
|----------|---------|
| What is MeowKit and how does it work? | [`meowkit-architecture.md`](meowkit-architecture.md) |
| How do I run the harness? | [`operations/harness-runbook.md`](operations/harness-runbook.md) |
| How do I write a skill? | [`governance/skill-authoring-guidelines.md`](governance/skill-authoring-guidelines.md) |
| What rules apply to my code? | [`meowkit-rules.md`](meowkit-rules.md) |
| How does memory work? | [`memory-system.md`](memory-system.md) |
| How does context isolation work? | [`architecture/context-isolation.md`](architecture/context-isolation.md) |
| Which skill handles X trigger? | [`architecture/trigger-registry.md`](architecture/trigger-registry.md) |
| Why was this architectural decision made? | [`architecture/adr/`](architecture/adr/) |
| What does the harness engineering philosophy say? | [`reference/the-harness-is-everything.md`](reference/the-harness-is-everything.md) |
| How does Anthropic recommend writing prompts? | [`reference/claude-prompting-best-practices.md`](reference/claude-prompting-best-practices.md) |
| How do I configure sub-agents? | [`reference/sub-agents.md`](reference/sub-agents.md) |
| What's the MeowKit visual style? | [`design/meowkit-design-guideline.md`](design/meowkit-design-guideline.md) |

---

## Conventions

- **Root files** — Loaded at runtime or enforced by CI. Do not move without updating referencing scripts.
- **architecture/** — System design documents. Cross-reference root-level `meowkit-architecture.md` for the ground-truth model.
- **governance/** — Rules and guides that govern contributions. The operational source of truth for rules lives in `.claude/rules/`.
- **reference/** — External documents that inform MeowKit design. These are not MeowKit-specific.
- **research/** — Active investigation. Files may be exploratory, deferred, or vendor-specific.
- **archive/** — Known-obsolete. Not cited by any active document.
