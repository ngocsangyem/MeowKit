<script setup lang="ts">
const features = [
  {
    name: '17 specialist agents',
    body: 'Dedicated agents for planning, security, review, testing, documentation, and more — each with scoped file ownership and model-tier routing.',
  },
  {
    name: '77 domain skills',
    body: 'From database migrations to multimodal AI, frontend design to CTF research — skills activate only when the task demands them.',
  },
  {
    name: 'Cross-session memory',
    body: 'Lessons, fixes, review patterns, and architecture decisions persist across sessions. The harness learns from every run.',
  },
  {
    name: 'Scale-adaptive intelligence',
    body: 'Domain complexity classification routes every task into TRIVIAL, STANDARD, or COMPLEX — picking the right model and scaffolding density automatically.',
  },
  {
    name: 'Party mode',
    body: 'Multi-agent deliberation for architectural decisions. Multiple agents argue different positions before a decision is made.',
  },
  {
    name: 'Adversarial review',
    body: 'Gate 2 runs parallel reviewers across correctness, security, design, scope, and craft. Any FAIL blocks the ship.',
  },
  {
    name: 'Zero external dependencies',
    body: 'Pure prompt engineering — no SDK required. Works offline, works in any Claude Code environment, no vendor lock-in.',
  },
  {
    name: 'TDD pipeline',
    body: 'Opt-in test-first enforcement with RED → GREEN → REFACTOR gates. Self-healing loop with 3-attempt cap and human escalation.',
  },
]
</script>

<template>
  <section id="features" class="spec" aria-labelledby="features-heading">
    <div class="container-landing">
      <div class="section-head">
        <h2 id="features-heading" class="section-head__title">
          Everything the harness enforces for you.
        </h2>
      </div>

      <!-- Spec sheet: each capability is a row, not a card -->
      <dl class="spec__sheet">
        <div v-for="feat in features" :key="feat.name" class="spec__row">
          <dt class="spec__name">{{ feat.name }}</dt>
          <dd class="spec__body">{{ feat.body }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.spec {
  padding-block: var(--space-3xl);
}

.spec__sheet {
  margin: 0;
  border-block-start: var(--rule-hair) solid var(--color-rule);
}

.spec__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2xs) var(--space-xl);
  padding-block: var(--space-md);
  border-block-end: var(--rule-hair) solid var(--color-rule-2);
}

@media (min-width: 40rem) {
  .spec__row {
    grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
    padding-block: var(--space-lg);
  }
}

.spec__name {
  font-weight: 500;
  font-size: var(--text-base);
  color: var(--color-ink);
  margin: 0;
}

.spec__body {
  font-size: var(--text-sm);
  color: var(--color-muted);
  line-height: 1.65;
  max-width: 64ch;
  margin: 0;
}
</style>
