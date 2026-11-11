<script setup lang="ts">
/* The hero's picture: a coding-agent session stopped at Gate 1.
 * Purely presentational — no props, no state; the steps arrive on a CSS stagger. */
const phases = [
  { n: '1', name: 'Plan', note: 'Waiting for your approval', on: true },
  { n: '3', name: 'Build', note: 'Blocked until Gate 1', on: false },
  { n: '4', name: 'Review', note: 'Gate 2 before ship', on: false },
]
</script>

<template>
  <div class="win" aria-hidden="true">
    <div class="win__bar">
      <span class="win__dots"><i /><i /><i /></span>
      <span class="win__title"><b>claude</b> · acme/api</span>
      <span class="win__spacer" />
      <span class="win__gate">Gate 1 · plan</span>
    </div>

    <div class="win__body">
      <div class="win__phases">
        <div v-for="p in phases" :key="p.n" class="phase" :class="{ 'is-on': p.on }">
          <i class="phase__n">{{ p.n }}</i>
          <b class="phase__name">{{ p.name }}</b>
          <span class="phase__note">{{ p.note }}</span>
        </div>
      </div>

      <div class="win__chat">
        <div class="msg msg--me">/mk:cook add webhook rate limiting</div>
        <div class="tool step" style="--i: 1">Writing the plan to tasks/plans</div>
        <div class="msg msg--bot step" style="--i: 2">
          The plan has 3 phases, 5 files and 4 acceptance criteria. Gate 1 is closed, so no source
          file has been edited yet.
          <small>plan.md · 78 lines</small>
        </div>
        <div class="acts step" style="--i: 3">
          <span class="acts__go">Approve plan</span>
          <span class="acts__alt">Edit</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.win {
  border-radius: var(--mk-radius-card);
  background: var(--mk-night);
  color: var(--mk-night-ink);
  font: 400 14px/1.4 var(--mk-font-sans);
  text-align: left;
  box-shadow: var(--mk-lift-night);
  overflow: hidden;
}

.win__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px;
  border-bottom: 1px solid var(--mk-night-line);
  font-size: 13px;
  color: var(--mk-night-muted);
}
.win__dots { display: flex; gap: 6px; }
.win__dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--mk-night-edge); }
.win__title b { font-weight: 500; color: var(--mk-night-ink); }
.win__spacer { flex: 1; }
.win__gate { white-space: nowrap; }

.win__body { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 300px; }

.win__phases {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 10px;
  border-right: 1px solid var(--mk-night-line);
}
.phase {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 1px 10px;
  padding: 9px 8px;
  border-radius: var(--mk-radius-inset);
  font-size: 13px;
}
.phase.is-on { background: rgb(255 255 255 / 0.07); }
.phase__n {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--mk-radius-inset);
  font: 500 13px/1 var(--mk-font-mono);
  font-style: normal;
  color: var(--mk-night);
  background: var(--mk-night-muted);
}
.phase.is-on .phase__n { background: var(--mk-sky); }
.phase__name { font-weight: 500; color: var(--mk-night-ink); }
.phase__note {
  grid-column: 2;
  color: #8b96aa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.win__chat {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 14px 18px;
  font-size: 14px;
}
.win__chat > * { min-width: 0; }

.msg {
  max-width: 86%;
  padding: 10px 14px;
  border-radius: var(--mk-radius-card);
  line-height: 1.45;
  overflow-wrap: break-word;
}
.msg--me {
  justify-self: end;
  background: var(--mk-paper);
  color: var(--mk-ink);
  font-family: var(--mk-font-mono);
  font-size: 13px;
}
.msg--bot { background: #1c2434; color: #e4e9f1; }
.msg--bot small { margin-left: 8px; font-size: 13px; opacity: 0.6; white-space: nowrap; }

.tool { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--mk-night-muted); }
.tool::before {
  content: "";
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: win-spin 1.1s linear infinite;
}

.acts { display: flex; flex-wrap: wrap; gap: 8px; }
.acts span {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--mk-radius-button);
  font-size: 13px;
  font-weight: 500;
}
.acts__go { background: var(--mk-sky); color: var(--mk-night); }
.acts__alt { background: rgb(255 255 255 / 0.08); color: #e4e9f1; }

/* the session arrives one line at a time, once, on load */
.step { animation: win-step 0.45s var(--mk-ease-out) calc(var(--i) * 0.42s) both; }
@keyframes win-step {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
@keyframes win-spin { to { transform: rotate(1turn); } }

@media (prefers-reduced-motion: reduce) {
  .step { animation: none; }
  .tool::before { animation: none; border-right-color: currentColor; }
}

@media (max-width: 899px) {
  .win__body { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .win__phases { display: none; }
}
@media (max-width: 639px) {
  .win__gate { display: none; }
  .msg { max-width: 100%; }
  .msg--me { justify-self: stretch; }
  .msg--bot small { display: block; margin: 4px 0 0; white-space: normal; }
}
</style>
