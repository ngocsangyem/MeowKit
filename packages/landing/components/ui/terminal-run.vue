<script setup lang="ts">
/* The install picture: `npx mewkit init` running to completion.
 * The command types itself on a CSS steps() animation and the caret blinks —
 * both are skipped wholesale under prefers-reduced-motion. */
const steps = [
  { path: '.claude/skills', n: '129 skills', t: '1.4s' },
  { path: '.claude/agents', n: '42 agents', t: '310ms' },
  { path: '.claude/hooks', n: '27 scripts', t: '204ms' },
  { path: '.claude/rules', n: '7 rules', t: '38ms' },
]
const summary = [
  { key: 'Directories', val: '2 added' },
  { key: 'Target', val: 'claude-code' },
]
</script>

<template>
  <div class="tr" aria-hidden="true">
    <div class="tr__head">
      <span class="tr__dots"><i /><i /><i /></span>
      <span class="tr__title">acme/api</span>
      <span class="tr__meta">zsh</span>
      <span class="tr__spacer" />
      <span class="tr__branch">main</span>
    </div>

    <div class="tr__screen">
      <div class="tr__ln tr__cmd">
        <span class="tr__cwd">~/<span class="tr__up">acme/</span>api</span>
        <span class="tr__sig">$</span>
        <span class="tr__typed">npx mewkit init</span>
      </div>

      <div class="tr__ln tr__meter tr__out" style="--i: 1">
        <span class="tr__bar"><i /></span>
        <span class="tr__count">4 of 4 folders</span>
      </div>

      <div v-for="(s, i) in steps" :key="s.path" class="tr__ln tr__log tr__out" :style="{ '--i': i + 2 }">
        <svg class="tr__tick" viewBox="0 0 16 16"><path d="m3.5 8.4 2.8 2.8 6.2-6.4" /></svg>
        <span class="tr__path">{{ s.path }}</span>
        <span class="tr__n">{{ s.n }}</span>
        <span class="tr__t">{{ s.t }}</span>
      </div>

      <div v-for="(s, i) in summary" :key="s.key" class="tr__ln tr__sum tr__out" :style="{ '--i': i + 6 }">
        <span class="tr__key">{{ s.key }}</span><span class="tr__val">{{ s.val }}</span>
      </div>

      <div class="tr__ln tr__done tr__out" style="--i: 8">
        <span class="tr__ok"><svg viewBox="0 0 16 16"><path d="m4.5 8.3 2.4 2.4 4.6-5" /></svg></span>
        <b>Done</b><span class="tr__dim">run /mk:cook to start a task</span>
      </div>

      <div class="tr__ln tr__cmd tr__out" style="--i: 9">
        <span class="tr__cwd">~/<span class="tr__up">acme/</span>api</span>
        <span class="tr__sig">$</span>
        <i class="tr__caret" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tr {
  width: min(100%, 480px);
  border-radius: var(--mk-radius-card);
  background: var(--mk-night);
  color: var(--mk-night-ink);
  box-shadow: var(--mk-lift-night);
  overflow: hidden;
}

.tr__head {
  display: flex;
  align-items: center;
  gap: var(--mk-space-xs);
  height: 38px;
  padding: 0 var(--mk-space-sm);
  border-bottom: 1px solid var(--mk-night-line);
  font-size: 12px;
  color: var(--mk-night-muted);
}
.tr__dots { display: flex; gap: 6px; }
.tr__dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--mk-night-edge); }
.tr__title { color: var(--mk-night-ink); }
.tr__spacer { flex: 1; }
.tr__branch { padding: 2px var(--mk-space-2xs); border-radius: var(--mk-radius-chip); background: rgb(255 255 255 / 0.07); }

.tr__screen {
  display: grid;
  gap: 5px;
  padding: var(--mk-space-sm);
  font-family: var(--mk-font-mono);
  font-size: 12px;
  line-height: 1.5;
}
.tr__ln { display: flex; align-items: center; gap: var(--mk-space-2xs); min-width: 0; }

.tr__cmd { color: var(--mk-night-ink); }
.tr__cwd { color: var(--mk-night-muted); white-space: nowrap; }
.tr__up { opacity: 0.6; }
.tr__sig { color: var(--mk-sky); }

/* the command types itself once, then the output arrives line by line */
.tr__typed {
  overflow: hidden;
  white-space: nowrap;
  animation: tr-type 1.1s steps(15) both;
}
.tr__out { animation: tr-in 0.3s var(--mk-ease-out) calc(1.15s + var(--i) * 0.11s) both; }

.tr__meter { gap: var(--mk-space-xs); }
.tr__bar { flex: 1; min-width: 0; height: 4px; border-radius: var(--mk-radius-button); background: rgb(255 255 255 / 0.1); }
.tr__bar i { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--mk-sky); }
.tr__count { color: var(--mk-night-muted); white-space: nowrap; }

.tr__log { color: var(--mk-night-muted); }
.tr__tick { flex: none; width: 12px; height: 12px; fill: none; stroke: var(--mk-sky); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tr__path { color: var(--mk-night-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr__n { margin-left: auto; white-space: nowrap; }
.tr__t { width: 48px; text-align: right; white-space: nowrap; }

.tr__sum { color: var(--mk-night-muted); }
.tr__key { min-width: 90px; }
.tr__val { color: var(--mk-night-ink); }

.tr__done { margin-top: var(--mk-space-2xs); }
.tr__ok { display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--mk-sky); }
.tr__ok svg { width: 11px; height: 11px; fill: none; stroke: var(--mk-night); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tr__done b { font-weight: 500; }
.tr__dim { color: var(--mk-night-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tr__caret {
  width: 7px;
  height: 14px;
  background: var(--mk-sky);
  animation: tr-blink 1.1s steps(1) infinite;
}

@keyframes tr-type { from { width: 0; } to { width: 15ch; } }
@keyframes tr-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes tr-blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .tr__typed, .tr__out, .tr__caret { animation: none; }
}

@media (max-width: 359px) {
  .tr__screen { font-size: 11px; padding: var(--mk-space-xs); }
  .tr__t, .tr__key { display: none; }
}
</style>
