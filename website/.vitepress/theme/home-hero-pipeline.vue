<script setup>
// Tier-A CSS art for the home hero image slot: the MeowKit ship pipeline.
// Pure HTML/CSS on design tokens — theme-aware in light and dark.
const steps = [
  { kind: 'phase', label: 'plan' },
  { kind: 'gate', label: 'GATE 1', detail: 'human approval' },
  { kind: 'phase', label: 'build · simplify · verify' },
  { kind: 'gate', label: 'GATE 2', detail: 'review verdict' },
  { kind: 'phase', label: 'ship' },
]
</script>

<template>
  <div class="mk-pipeline" aria-label="MeowKit workflow: plan, Gate 1 human approval, build, Gate 2 review verdict, ship">
    <div class="mk-pipeline__head">
      <span class="mk-pipeline__title">workflow</span>
      <span class="mk-pipeline__meta">2 hard gates</span>
    </div>
    <ol class="mk-pipeline__list">
      <li
        v-for="(step, i) in steps"
        :key="step.label"
        class="mk-pipeline__step"
        :class="`mk-pipeline__step--${step.kind}`"
      >
        <span class="mk-pipeline__node" aria-hidden="true" />
        <span class="mk-pipeline__label">{{ step.label }}</span>
        <span v-if="step.detail" class="mk-pipeline__detail">{{ step.detail }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.mk-pipeline {
  width: 100%;
  max-width: 300px;
  background-color: var(--vp-c-bg-alt);
  border: 1px solid var(--mk-border-subtle);
  border-radius: var(--mk-radius-md);
  padding: var(--mk-space-4) var(--mk-space-5) var(--mk-space-5);
  box-shadow: var(--mk-shadow-card);
  font-family: var(--mk-font-mono);
  text-align: left;
}

.mk-pipeline__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid var(--mk-border-subtle);
  padding-bottom: var(--mk-space-3);
  margin-bottom: var(--mk-space-4);
}

.mk-pipeline__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  letter-spacing: 0.08em;
}

.mk-pipeline__meta {
  font-size: 11px;
  color: var(--vp-c-brand-1);
}

.mk-pipeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

/* vertical connector through the nodes */
.mk-pipeline__list::before {
  content: '';
  position: absolute;
  left: 5px;
  top: var(--mk-space-2);
  bottom: var(--mk-space-2);
  width: 1px;
  background-color: var(--mk-border-strong);
}

.mk-pipeline__step {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: var(--mk-space-2);
  padding: var(--mk-space-2) 0 var(--mk-space-2) var(--mk-space-6);
  min-width: 0;
}

.mk-pipeline__node {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 11px;
  height: 11px;
  border-radius: var(--mk-radius-pill);
  background-color: var(--vp-c-bg-alt);
  border: 1px solid var(--mk-border-strong);
}

.mk-pipeline__step--gate .mk-pipeline__node {
  background-color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.mk-pipeline__label {
  font-size: 13px;
  color: var(--vp-c-text-1);
  overflow-wrap: anywhere;
}

.mk-pipeline__step--gate .mk-pipeline__label {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  letter-spacing: 0.06em;
}

.mk-pipeline__detail {
  font-size: 11px;
  color: var(--vp-c-text-2);
  overflow-wrap: anywhere;
}
</style>
