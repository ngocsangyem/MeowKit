<script setup lang="ts">
/* Right pane of the workflow picture: one task's run. Presentational only. */
type Step = { name: string, cmd: string, time: string, state: 'done' | 'run' | 'queued' }

const steps: Step[] = [
  { name: 'Plan', cmd: 'Gate 1 approved', time: '2m 04s', state: 'done' },
  { name: 'Build', cmd: '5 files edited', time: '3m 18s', state: 'done' },
  { name: 'Verify', cmd: 'npm test', time: '50s', state: 'run' },
  { name: 'Review', cmd: '5 dimensions', time: 'Queued', state: 'queued' },
  { name: 'Ship', cmd: 'Waits for Gate 2', time: 'Queued', state: 'queued' },
]

const log = [
  { cmd: true, text: 'npm run lint && npm run typecheck && npm test' },
  { cmd: false, text: 'webhooks/rate-limit.test: 14 passed' },
  { cmd: false, text: 'webhooks/retry.test: 9 passed' },
]
</script>

<template>
  <div class="pb" aria-hidden="true">
    <div class="pb__head">
      <svg class="pb__branch" viewBox="0 0 16 16">
        <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5" r="1.5" />
        <path d="M4.5 5v6M11.5 6.5c0 2.6-2.2 3.6-5.6 4.6" />
      </svg>
      <span class="pb__repo">acme/api</span>
      <i class="pb__slash">/</i>
      <code class="pb__ref">webhook-rate-limit</code>
      <span class="pb__spacer" />
      <span class="pb__total">6m 12s</span>
      <span class="pb__chip">Running</span>
    </div>

    <div class="pb__commit">
      <span class="pb__av">DV</span>
      <span class="pb__msg">Add rate limiting to the webhook endpoint</span>
      <code class="pb__sha">plan.md</code>
      <span class="pb__btn">Cancel</span>
    </div>

    <ol class="pb__steps">
      <li v-for="s in steps" :key="s.name" class="pb__step" :class="`is-${s.state}`">
        <span class="pb__ico">
          <svg viewBox="0 0 16 16"><path d="m4.5 8.2 2.3 2.3 4.7-5" /></svg>
        </span>
        <span class="pb__nm">{{ s.name }}</span>
        <code class="pb__cmd">{{ s.cmd }}</code>
        <span class="pb__time">{{ s.time }}</span>
        <span v-if="s.state === 'run'" class="pb__bar"><i /></span>
      </li>
    </ol>

    <div class="pb__log">
      <span v-for="(l, i) in log" :key="i" class="pb__line">
        <b v-if="l.cmd">$</b>{{ l.text }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.pb { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: var(--mk-space-sm); gap: var(--mk-space-sm); font-size: 13px; }

.pb__head { display: flex; align-items: center; gap: var(--mk-space-2xs); min-width: 0; color: var(--mk-muted); }
.pb__branch { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.3; }
.pb__repo { white-space: nowrap; }
.pb__slash { font-style: normal; opacity: 0.5; }
.pb__ref {
  padding: 2px var(--mk-space-2xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-chip);
  background: var(--mk-paper);
  font-family: var(--mk-font-mono);
  font-size: 12px;
  color: var(--mk-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pb__spacer { flex: 1; min-width: var(--mk-space-2xs); }
.pb__total { white-space: nowrap; }
.pb__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 var(--mk-space-xs);
  border-radius: var(--mk-radius-button);
  background: var(--mk-ink);
  color: var(--mk-paper);
  font-size: 12px;
  white-space: nowrap;
}
.pb__chip::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mk-sky);
  animation: pb-pulse 1.6s var(--mk-ease) infinite;
}

.pb__commit { display: flex; align-items: center; gap: var(--mk-space-xs); min-width: 0; }
.pb__av {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--mk-haze);
  font-family: var(--mk-font-mono);
  font-size: 10px;
  font-weight: 500;
}
.pb__msg { flex: 1; min-width: 0; color: var(--mk-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb__sha { font-family: var(--mk-font-mono); font-size: 12px; color: var(--mk-muted); white-space: nowrap; }
.pb__btn {
  flex: none;
  padding: 4px var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-chip);
  font-size: 12px;
  color: var(--mk-muted);
}

.pb__steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: var(--mk-space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pb__step {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  min-width: 0;
  gap: 2px var(--mk-space-2xs);
  padding: var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-inset);
  background: var(--mk-paper);
  overflow: hidden;
}
.pb__step.is-run { border-color: var(--mk-accent); }
.pb__ico { grid-row: 1; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--mk-line); }
.pb__ico svg { width: 11px; height: 11px; fill: none; stroke: transparent; stroke-width: 2; stroke-linecap: round; }
.pb__step.is-done .pb__ico { border-color: var(--mk-ink); }
.pb__step.is-done .pb__ico svg { stroke: var(--mk-ink); }
.pb__step.is-run .pb__ico { border-color: var(--mk-accent); background: var(--mk-accent); }
.pb__nm { font-weight: 500; color: var(--mk-ink); }
.pb__cmd,
.pb__time { grid-column: 2; font-family: var(--mk-font-mono); font-size: 11px; color: var(--mk-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* the mockup's step cards show a name and a time only — the commands are in the log */
.pb__cmd { display: none; }
.pb__bar { position: absolute; inset: auto 0 0 0; height: 3px; background: var(--mk-haze); }
.pb__bar i { display: block; width: 60%; height: 100%; background: var(--mk-accent); }

.pb__log {
  display: grid;
  /* the track must be allowed to shrink, or a long line is clipped by the box
   * instead of being ellipsised by the line itself */
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 2px;
  flex: 1;
  min-height: 90px;
  padding: var(--mk-space-xs);
  border-radius: var(--mk-radius-inset);
  background: var(--mk-paper);
  font-family: var(--mk-font-mono);
  font-size: 12px;
  color: var(--mk-muted);
  overflow: hidden;
}
.pb__line { min-width: 0; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb__line b { margin-right: var(--mk-space-2xs); color: var(--mk-accent); }

@keyframes pb-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .pb__chip::before { animation: none; } }

@media (min-width: 1024px) { .pb { padding: var(--mk-space-md); } }
@media (max-width: 639px) {
  .pb__steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pb__sha, .pb__btn { display: none; }
  /* a narrow terminal wraps its lines; it does not truncate them */
  .pb__log { min-height: 128px; }
  .pb__line { white-space: pre-wrap; overflow-wrap: anywhere; text-overflow: clip; }
}
</style>
