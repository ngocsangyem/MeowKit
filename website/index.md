---
layout: home
hero:
  name: MeowKit
  text: Enforced discipline for AI coding agents
  tagline: Hard gates, TDD, security scanning, and human approval — so your AI agent ships production-quality code, not untested prototypes.
  image:
    src: /logo.png
    alt: MeowKit Logo
  actions:
    - theme: brand
      text: Get Started →
      link: /quick-start
    - theme: alt
      text: Why MeowKit
      link: /why-meowkit
features:
  - title: 🔒 Two Hard Gates
    details: No code ships without an approved plan (Gate 1) and a passing review (Gate 2). The agent cannot self-approve.
  - title: 🧪 TDD Opt-In
    details: TDD is opt-in via `--tdd` or `MEOWKIT_TDD=1`. When enabled, failing tests must exist before implementation; otherwise tests are recommended but not gated. Default mode keeps spike work fast; production builds opt in for strict discipline.
  - title: 🛡️ 4-Layer Security
    details: Prompt injection defense across input boundary, instruction anchoring, context isolation, and output validation.
  - title: 🧠 14 Specialist Agents
    details: Each agent owns a specific concern — planning, testing, reviewing, shipping. No two agents modify the same files.
  - title: ⚡ 49+ Skills
    details: From docs retrieval to multimodal analysis, code review to QA testing. Step-file architecture for JIT loading keeps context tight.
  - title: 💾 Cross-Session Memory
    details: Lessons, patterns, and costs persist across sessions. After 10 sessions, the analyst proposes CLAUDE.md improvements.
  - title: 📋 Structured Task System
    details: Template-driven task files help agents resume work without losing context. Five template types with acceptance criteria, constraints, and live agent state tracking.
  - title: 🎯 Scale-Adaptive Intelligence
    details: Auto-classifies task complexity by domain at Phase 0. Fintech and healthcare route to COMPLEX automatically — no manual guessing.
  - title: 🗣️ Party Mode
    details: /meow:party for multi-agent deliberation. 2-4 agents debate architecture decisions with forced synthesis before any code is written.
  - title: 🔍 Adversarial Review
    details: Three parallel reviewers — Blind Hunter, Edge Case Hunter, Criteria Auditor — catch 2-3x more bugs than single-pass review.
  - title: 🚦 Hook-Based Enforcement
    details: Shell hooks block sensitive file reads and source writes before they happen — not after the agent has rationalized past the rule. Rules define why; hooks enforce what.
  - title: 🧭 Navigation Help
    details: /meow:help scans plans, reviews, tests, and git to determine where you are in the pipeline and prints the single next action. Re-orient instantly after any interruption.
---
