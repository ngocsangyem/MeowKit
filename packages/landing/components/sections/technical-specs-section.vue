<script setup lang="ts">
const stats = [
  { value: '77', label: 'skills' },
  { value: '17', label: 'agents' },
  { value: '21', label: 'commands' },
  { value: '7', label: 'modes' },
  { value: '19', label: 'rules' },
  { value: '27', label: 'hooks' },
]
</script>

<template>
  <section class="specs" aria-labelledby="specs-heading">
    <div class="container-landing">
      <div class="section-head">
        <h2 id="specs-heading" class="section-head__title">By the numbers.</h2>
      </div>

      <!-- Stat strip: one row, hairline-separated, tabular numerals -->
      <div class="specs__strip" role="list" aria-label="Toolkit inventory">
        <div v-for="stat in stats" :key="stat.label" role="listitem" class="specs__cell">
          <b class="specs__value">{{ stat.value }}</b>
          <span class="specs__label mono">{{ stat.label }}</span>
        </div>
      </div>

      <p class="specs__badges mono">
        zero external dependencies&ensp;·&ensp;MIT license&ensp;·&ensp;works offline&ensp;·&ensp;SSR compatible
      </p>
    </div>
  </section>
</template>

<style scoped>
.specs {
  padding-block: var(--space-2xl) var(--space-3xl);
}

.specs__strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-block: var(--rule-hair) solid var(--color-rule);
  font-variant-numeric: tabular-nums;
}

@media (min-width: 40rem) {
  .specs__strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 60rem) {
  .specs__strip { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}

.specs__cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-lg) var(--space-md);
  border-inline-end: var(--rule-hair) solid var(--color-rule-2);
}

.specs__cell:last-child { border-inline-end: none; }

/* Interior grid edges only — trailing cells per breakpoint drop their rule */
@media (max-width: 39.999rem) {
  .specs__cell:nth-child(2n) { border-inline-end: none; }
}
@media (min-width: 40rem) and (max-width: 59.999rem) {
  .specs__cell:nth-child(3n) { border-inline-end: none; }
}

.specs__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-2xl);
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--color-ink);
}

.specs__label {
  letter-spacing: 0.04em;
}

.specs__badges {
  margin: var(--space-lg) 0 0;
  letter-spacing: 0.02em;
}
</style>
