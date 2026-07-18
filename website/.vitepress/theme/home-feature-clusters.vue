<script setup>
// Clustered feature grid for the home-features-after slot.
// Replaces the flat 12-card frontmatter grid with three themed groups.
const clusters = [
  {
    title: 'Enforcement',
    lede: 'Hard stops the agent cannot talk its way past.',
    items: [
      { title: 'Two Hard Gates', detail: 'No code ships without an approved plan (Gate 1) and a passing review (Gate 2). The agent cannot self-approve.' },
      { title: '4-Layer Security', detail: 'Prompt injection defense across input boundary, instruction anchoring, context isolation, and output validation.' },
      { title: 'Hook-Based Enforcement', detail: 'Shell hooks block sensitive file reads and source writes before they happen — not after the agent has rationalized past the rule. Rules define why; hooks enforce what.' },
      { title: 'Adversarial Review', detail: 'Three parallel reviewers — Blind Hunter, Edge Case Hunter, Criteria Auditor — catch 2-3x more bugs than single-pass review.' },
    ],
  },
  {
    title: 'Intelligence',
    lede: 'The right specialist, skill, and context for every task.',
    items: [
      { title: 'Specialist Agents', detail: 'Each agent owns a specific concern — planning, testing, reviewing, shipping. No two agents modify the same files.' },
      { title: 'Domain Skills', detail: 'From docs retrieval to multimodal analysis, code review to QA testing. Step-file architecture loads skills on demand, keeping context tight.' },
      { title: 'Cross-Session Memory', detail: 'Lessons, patterns, and costs persist across sessions. After 10 sessions, the analyst proposes CLAUDE.md improvements.' },
      { title: 'Scale-Adaptive Intelligence', detail: 'Auto-classifies task complexity by domain at Phase 0. Fintech and healthcare route to COMPLEX automatically — no manual guessing.' },
    ],
  },
  {
    title: 'Workflow',
    lede: 'Discipline that survives interruptions and long sessions.',
    items: [
      { title: 'TDD Opt-In', detail: 'Opt-in via --tdd or MEOWKIT_TDD=1. When enabled, failing tests must exist before implementation. Default mode keeps spike work fast; production builds opt in for strict discipline.' },
      { title: 'Structured Task System', detail: 'Template-driven task files help agents resume work without losing context. Five template types with acceptance criteria, constraints, and live agent state tracking.' },
      { title: 'Party Mode', detail: '/mk:party for multi-agent deliberation. 2-4 agents debate architecture decisions with forced synthesis before any code is written.' },
      { title: 'Navigation Help', detail: '/mk:help scans plans, reviews, tests, and git to determine where you are in the pipeline and prints the single next action. Re-orient instantly after any interruption.' },
    ],
  },
]
</script>

<template>
  <section class="mk-clusters" aria-label="MeowKit features">
    <div v-for="cluster in clusters" :key="cluster.title" class="mk-cluster">
      <header class="mk-cluster__head">
        <h2 class="mk-cluster__title">{{ cluster.title }}</h2>
        <p class="mk-cluster__lede">{{ cluster.lede }}</p>
      </header>
      <div class="mk-cluster__grid">
        <article v-for="item in cluster.items" :key="item.title" class="mk-card">
          <h3 class="mk-card__title">{{ item.title }}</h3>
          <p class="mk-card__detail">{{ item.detail }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mk-clusters {
  margin: 0 auto;
  max-width: 1152px;
  padding: var(--mk-space-8) var(--mk-space-6) var(--mk-space-20);
}

.mk-cluster {
  border-top: 1px solid var(--mk-border-subtle);
  padding-top: var(--mk-space-8);
}

.mk-cluster + .mk-cluster {
  margin-top: var(--mk-space-16);
}

.mk-cluster__head {
  margin-bottom: var(--mk-space-8);
}

.mk-cluster__title {
  font-family: var(--mk-font-display);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
  margin: 0;
}

.mk-cluster__lede {
  font-size: 15px;
  color: var(--vp-c-text-2);
  margin: var(--mk-space-2) 0 0;
}

.mk-cluster__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--mk-space-4);
}

@media (min-width: 640px) {
  .mk-clusters {
    padding-left: var(--mk-space-12);
    padding-right: var(--mk-space-12);
  }

  .mk-cluster__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .mk-clusters {
    padding-left: var(--mk-space-16);
    padding-right: var(--mk-space-16);
  }

  .mk-cluster__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.mk-card {
  background-color: var(--vp-c-bg-alt);
  border: 1px solid var(--mk-border-subtle);
  border-radius: var(--mk-radius-md);
  padding: var(--mk-space-6);
  min-width: 0;
  transition: border-color var(--mk-transition-normal);
}

.mk-card:hover {
  border-color: color-mix(in oklab, var(--mk-blue-600) 40%, transparent);
}

.mk-card__title {
  font-family: var(--mk-font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
  margin: 0 0 var(--mk-space-2);
}

.mk-card__detail {
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0;
}
</style>
