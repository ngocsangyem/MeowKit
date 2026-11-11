<script setup lang="ts">
/* Feature picture 3: the two committed memory files. */
const files = [
  { name: 'decisions.md', kind: 'Why a choice was made' },
  { name: 'gotchas.md', kind: 'What a failure taught' },
]
</script>

<template>
  <div class="mf" aria-hidden="true">
    <div class="mf__status"><span class="mf__dot" />2 files read</div>
    <ul class="mf__grid">
      <li v-for="f in files" :key="f.name" class="mf__file">
        <span class="mf__ext">MD</span>
        <span class="mf__name">{{ f.name }}</span>
        <span class="mf__kind">{{ f.kind }}</span>
        <span class="mf__check">
          <svg viewBox="0 0 16 16"><path d="m4.5 8.2 2.3 2.3 4.7-5" /></svg>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mf { width: min(100%, 400px); font-size: 13px; }

.mf__status {
  display: inline-flex;
  align-items: center;
  gap: var(--mk-space-2xs);
  margin-bottom: var(--mk-space-xs);
  padding: 4px var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-button);
  background: var(--mk-paper);
  color: var(--mk-muted);
}
.mf__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mk-accent); }

.mf__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--mk-space-xs); margin: 0; padding: 0; list-style: none; }

.mf__file {
  position: relative;
  display: grid;
  gap: var(--mk-space-3xs);
  padding: var(--mk-space-sm);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-inset);
  background: var(--mk-paper);
  box-shadow: var(--mk-lift-card);
}
.mf__ext {
  justify-self: start;
  margin-bottom: var(--mk-space-2xs);
  padding: 2px 6px;
  border-radius: var(--mk-radius-chip);
  background: var(--mk-haze);
  font-family: var(--mk-font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--mk-accent);
}
.mf__name { font-family: var(--mk-font-mono); font-size: 12px; color: var(--mk-ink); overflow: hidden; text-overflow: ellipsis; }
.mf__kind { color: var(--mk-muted); font-size: 12px; }

.mf__check {
  position: absolute;
  top: var(--mk-space-xs);
  right: var(--mk-space-xs);
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--mk-accent);
}
.mf__check svg { width: 11px; height: 11px; fill: none; stroke: var(--mk-on-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
