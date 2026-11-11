<script setup lang="ts">
/* Feature picture 1: Gate 1's conditions, two of five met. */
const items = [
  { label: 'Plan file exists', done: true },
  { label: 'Problem is written down', done: true },
  { label: 'Success criteria are measurable', done: false },
  { label: 'You typed the approval', done: false },
  { label: 'Receipt matches the plan hash', done: false },
]
</script>

<template>
  <div class="cl" aria-hidden="true">
    <div class="cl__head">
      <span class="cl__title">Gate 1</span>
      <span class="cl__count">2 of 5</span>
    </div>
    <div class="cl__bar"><i /></div>
    <ul class="cl__list">
      <li v-for="it in items" :key="it.label" class="cl__item" :class="{ 'is-done': it.done }">
        <span class="cl__box">
          <svg viewBox="0 0 16 16"><path d="m4.5 8.2 2.3 2.3 4.7-5" /></svg>
        </span>
        {{ it.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cl {
  width: min(100%, 340px);
  padding: var(--mk-space-sm);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-inset);
  background: var(--mk-paper);
  box-shadow: var(--mk-lift-card);
  font-size: 13px;
}
.cl__head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-xs); }
.cl__title { font-weight: 500; color: var(--mk-ink); }
.cl__count { color: var(--mk-muted); }

.cl__bar { height: 4px; margin: var(--mk-space-xs) 0 var(--mk-space-sm); border-radius: var(--mk-radius-button); background: var(--mk-haze); }
.cl__bar i { display: block; width: 40%; height: 100%; border-radius: inherit; background: var(--mk-accent); }

.cl__list { display: grid; gap: var(--mk-space-xs); margin: 0; padding: 0; list-style: none; }
.cl__item { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: var(--mk-space-xs); align-items: center; color: var(--mk-muted); }
.cl__item.is-done { color: var(--mk-ink); }
.cl__box {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--mk-line);
  border-radius: var(--mk-radius-chip);
}
.cl__box svg { width: 12px; height: 12px; fill: none; stroke: transparent; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cl__item.is-done .cl__box { border-color: var(--mk-accent); background: var(--mk-accent); }
.cl__item.is-done .cl__box svg { stroke: var(--mk-on-accent); }
</style>
