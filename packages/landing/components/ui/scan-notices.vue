<script setup lang="ts">
/* Feature picture 2: what the write scanner reports. */
const notes = [
  { ini: 'SC', tone: 5, title: 'Write blocked', time: 'now', body: 'API key found in src/config.ts', btn: 'Open' },
  { ini: 'RV', tone: 2, title: 'Query flagged', time: '4m', body: 'Template literal in orders.repo.ts', btn: '' },
  { ini: '', tone: 0, title: '31 writes scanned', time: '12m', body: 'No blocked pattern in this task', btn: '' },
]
</script>

<template>
  <ul class="nt" aria-hidden="true">
    <li v-for="n in notes" :key="n.title" class="nt__item">
      <span v-if="n.ini" class="nt__av" :data-tone="n.tone">{{ n.ini }}</span>
      <span v-else class="nt__ico">
        <svg viewBox="0 0 16 16"><path d="m3.5 8.4 2.8 2.8 6.2-6.4" /></svg>
      </span>
      <span class="nt__text">
        <span class="nt__title">{{ n.title }}<time>{{ n.time }}</time></span>
        <span class="nt__body">{{ n.body }}</span>
      </span>
      <span v-if="n.btn" class="nt__btn">{{ n.btn }}</span>
    </li>
  </ul>
</template>

<style scoped>
.nt { display: grid; gap: var(--mk-space-2xs); width: min(100%, 380px); margin: 0; padding: 0; list-style: none; font-size: 13px; }

.nt__item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--mk-space-xs);
  padding: var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-inset);
  background: var(--mk-paper);
  box-shadow: var(--mk-lift-card);
}

.nt__av,
.nt__ico {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--mk-haze);
  font-family: var(--mk-font-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--mk-ink);
}
.nt__av[data-tone="2"] { background: #d9c9c9; }
.nt__av[data-tone="5"] { background: #e0d6c4; }
.nt__ico svg { width: 13px; height: 13px; fill: none; stroke: var(--mk-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.nt__text { display: grid; gap: 2px; min-width: 0; }
.nt__title { display: flex; align-items: baseline; gap: var(--mk-space-2xs); font-weight: 500; color: var(--mk-ink); }
.nt__title time { font-size: 11px; font-weight: 400; color: var(--mk-muted); }
.nt__body { color: var(--mk-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nt__btn {
  padding: 4px var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-button);
  font-size: 12px;
  color: var(--mk-ink);
}
</style>
