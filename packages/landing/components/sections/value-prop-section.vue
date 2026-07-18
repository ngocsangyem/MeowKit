<script setup lang="ts">
const pillars = [
  {
    title: 'Two hard gates',
    body: 'No code ships without an approved plan and a passing review. Every change must clear both stops — no bypasses, no self-approval.',
  },
  {
    title: 'TDD opt-in',
    body: 'Strict test-first discipline when enabled, fast spikes when you need speed. The harness adapts without relaxing quality standards.',
  },
  {
    title: '4-layer security',
    body: 'Prompt injection defense across input, instruction, context, and output layers. Untrusted content is data — never instructions.',
  },
]
</script>

<template>
  <section class="vp" aria-labelledby="vp-heading">
    <div class="container-landing">
      <div class="section-head">
        <h2 id="vp-heading" class="section-head__title">The harness is the product.</h2>
        <p class="section-head__sub">
          Models provide intelligence. MeowKit provides the constraints, safety gates,
          and repeatable workflows that production engineering demands.
        </p>
      </div>

      <div class="vp__rows">
        <article v-for="pillar in pillars" :key="pillar.title" class="vp__row">
          <h3 class="vp__row-title">{{ pillar.title }}</h3>
          <p class="vp__row-body">{{ pillar.body }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.vp {
  padding-block: var(--space-3xl) var(--space-2xl);
}

.vp__rows {
  border-block-start: var(--rule-hair) solid var(--color-rule);
}

.vp__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-sm) var(--space-xl);
  padding-block: var(--space-lg);
  border-block-end: var(--rule-hair) solid var(--color-rule);
}

@media (min-width: 40rem) {
  .vp__row {
    grid-template-columns: 5fr 7fr;
    padding-block: var(--space-xl);
  }
}

.vp__row-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-lg);
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--color-ink);
  margin: 0;
}

.vp__row-body {
  font-size: var(--text-base);
  color: var(--color-muted);
  line-height: 1.65;
  max-width: 52ch;
  margin: 0;
}
</style>
