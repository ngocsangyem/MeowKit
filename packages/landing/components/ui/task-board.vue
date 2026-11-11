<script setup lang="ts">
/* Left pane of the workflow picture: the task list. Presentational only. */
type Row = { ini: string, tone: number, who: string, sub: string, st: string, state: '' | 'you' | 'done', age: string }

const rows: Row[] = [
  { ini: 'DV', tone: 1, who: 'developer', sub: 'Webhook rate limit · 5 files', st: 'Verified', state: 'done', age: '2m' },
  { ini: 'PL', tone: 3, who: 'planner', sub: 'Invoice export · 3 phases', st: 'Building', state: '', age: '6m' },
  { ini: 'TS', tone: 4, who: 'tester', sub: 'Session expiry · 14 tests', st: 'Planned', state: '', age: '11m' },
  { ini: 'RV', tone: 2, who: 'reviewer', sub: 'Retry queue · Gate 2', st: 'Needs you', state: 'you', age: '18m' },
  { ini: 'SC', tone: 5, who: 'security', sub: 'Token rotation · no blocks', st: 'Verified', state: 'done', age: '24m' },
  { ini: 'SH', tone: 3, who: 'shipper', sub: 'Audit log · pull request open', st: 'Verified', state: 'done', age: '31m' },
  { ini: 'DV', tone: 1, who: 'developer', sub: 'CSV import · 2 files', st: 'Verified', state: 'done', age: '44m' },
  { ini: 'DC', tone: 4, who: 'documenter', sub: 'Changelog sync · 1 file', st: 'Verified', state: 'done', age: '52m' },
  { ini: 'RV', tone: 2, who: 'reviewer', sub: 'Search filters · Gate 2', st: 'Verified', state: 'done', age: '1h' },
  { ini: 'PL', tone: 3, who: 'planner', sub: 'Billing webhooks · 4 phases', st: 'Verified', state: 'done', age: '2h' },
]

const folders = ['Plans', 'Reviews']
</script>

<template>
  <div class="tb" aria-hidden="true">
    <div class="tb__bar">
      <span class="tb__dots"><i /><i /><i /></span>
      <span class="tb__crumb">MeowKit <i>/</i> <b>Tasks</b></span>
      <span class="tb__spacer" />
      <span class="tb__search">
        <svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
        Search<span class="tb__kbd">/</span>
      </span>
    </div>

    <div class="tb__body">
      <nav class="tb__side">
        <span class="tb__nav is-on">Active<em>6</em></span>
        <span class="tb__nav">Gated<em>2</em></span>
        <span class="tb__nav">Shipped</span>
        <span class="tb__label">Folders</span>
        <span v-for="f in folders" :key="f" class="tb__nav"><i class="tb__hash">#</i>{{ f }}</span>
      </nav>

      <div class="tb__main">
        <div class="tb__cols"><span>Agent</span><span>Task</span><span>Status</span><span>Age</span></div>
        <ul class="tb__rows">
          <li v-for="(r, i) in rows" :key="i" class="tb__row">
            <span class="tb__av" :data-tone="r.tone">{{ r.ini }}</span>
            <span class="tb__who">{{ r.who }}</span>
            <span class="tb__sub">{{ r.sub }}</span>
            <span class="tb__st" :class="`is-${r.state || 'run'}`">{{ r.st }}</span>
            <span class="tb__age">{{ r.age }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tb { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 13px; }

.tb__bar {
  display: flex;
  align-items: center;
  gap: var(--mk-space-xs);
  flex: none;
  height: 44px;
  padding: 0 var(--mk-space-sm);
  border-bottom: 1px solid var(--mk-line-soft);
  color: var(--mk-muted);
}
.tb__dots { display: flex; gap: 6px; }
.tb__dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--mk-line); }
.tb__crumb { white-space: nowrap; }
.tb__crumb i { font-style: normal; opacity: 0.5; }
.tb__crumb b { font-weight: 500; color: var(--mk-ink); }
.tb__spacer { flex: 1; }
.tb__search {
  display: inline-flex;
  align-items: center;
  gap: var(--mk-space-2xs);
  height: 28px;
  padding: 0 var(--mk-space-2xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-button);
  white-space: nowrap;
}
.tb__search svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.4; }
.tb__kbd {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: var(--mk-haze);
  font-family: var(--mk-font-mono);
  font-size: 11px;
}

.tb__body { display: grid; grid-template-columns: 150px minmax(0, 1fr); flex: 1; min-height: 0; }

.tb__side {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: var(--mk-space-xs);
  border-right: 1px solid var(--mk-line-soft);
}
.tb__nav {
  display: flex;
  align-items: center;
  gap: var(--mk-space-2xs);
  padding: 7px var(--mk-space-2xs);
  border-radius: var(--mk-radius-chip);
  color: var(--mk-muted);
  white-space: nowrap;
}
.tb__nav.is-on { background: var(--mk-haze); color: var(--mk-ink); font-weight: 500; }
.tb__nav em { margin-left: auto; font-style: normal; opacity: 0.7; }
.tb__hash { font-style: normal; opacity: 0.6; }
.tb__label { padding: var(--mk-space-sm) var(--mk-space-2xs) var(--mk-space-3xs); font-size: 12px; color: var(--mk-muted); }

.tb__main { min-width: 0; overflow: hidden; }
.tb__cols,
.tb__row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 32px;
  align-items: center;
  gap: var(--mk-space-2xs) var(--mk-space-xs);
  padding: 0 var(--mk-space-sm);
}
.tb__cols {
  height: 30px;
  border-bottom: 1px solid var(--mk-line-soft);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--mk-muted);
}
.tb__cols span:first-child { grid-column: 1 / 3; }

.tb__rows { margin: 0; padding: 0; list-style: none; }
.tb__row { padding-block: var(--mk-space-xs); border-bottom: 1px solid var(--mk-line-soft); }
.tb__av {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  grid-column: 1;
  grid-row: 1 / span 2;
  border-radius: 50%;
  background: var(--mk-haze);
  font-family: var(--mk-font-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--mk-ink);
}
.tb__av[data-tone="2"] { background: #d9c9c9; }
.tb__av[data-tone="3"] { background: #cfd8c9; }
.tb__av[data-tone="4"] { background: #d3cddf; }
.tb__av[data-tone="5"] { background: #e0d6c4; }
.tb__who { grid-column: 2; grid-row: 1; font-weight: 500; color: var(--mk-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb__sub {
  grid-column: 2;
  grid-row: 2;
  color: var(--mk-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb__st {
  grid-column: 3;
  grid-row: 1 / span 2;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-button);
  font-size: 12px;
  color: var(--mk-muted);
  white-space: nowrap;
}
.tb__st::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.tb__st.is-you { background: var(--mk-ink); border-color: var(--mk-ink); color: var(--mk-paper); }
.tb__st.is-run { background: var(--mk-haze); color: var(--mk-accent); }
.tb__age { grid-column: 4; grid-row: 1 / span 2; color: var(--mk-muted); text-align: right; }

@media (max-width: 1023px) { .tb__side { display: none; } .tb__body { grid-template-columns: minmax(0, 1fr); } }
</style>
