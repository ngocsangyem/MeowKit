<script setup lang="ts">
/* Section 4 — what the hooks actually enforce. Copy verbatim from the mockup. */
</script>

<template>
  <section class="mk-section" id="features" aria-labelledby="features-h">
    <div class="mk-wrap">
      <div class="mk-head fg__head">
        <h2 id="features-h">
          Hooks enforce the rules. <span class="mk-dim">The agent cannot talk its way past them.</span>
        </h2>
      </div>

      <div class="mk-grid fg__grid">
        <article class="mk-card mk-col-6 mk-reveal">
          <h3>Blocks edits without an approved plan</h3>
          <p>A hook refuses every source edit until the plan carries an approval receipt, and again once the plan body changes.</p>
          <div class="mk-stage fg__panel"><GateChecklist /></div>
        </article>

        <article class="mk-card mk-col-6 mk-reveal">
          <h3>Scans every write for blocked patterns</h3>
          <p>Hardcoded secrets, interpolated SQL and auth tokens in localStorage are stopped as the file is written.</p>
          <div class="mk-stage fg__panel fg__panel--low"><ScanNotices /></div>
        </article>

        <article class="mk-card mk-col-6 mk-reveal">
          <h3>Keeps team memory in two files</h3>
          <p>Decisions and gotchas live in committed markdown. Skills grep them at the start of a task and open only the matching entries.</p>
          <div class="mk-stage fg__panel"><MemoryFiles /></div>
        </article>

        <article class="mk-card mk-col-6 mk-reveal">
          <h3>Installs into three coding agents</h3>
          <p>Claude Code gets real hook enforcement. Cursor and Codex get the same skills; on Codex the gates advise and do not block.</p>
          <div class="mk-stage fg__panel fg__panel--flat"><AgentsHub /></div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fg__head h2 { max-width: 20ch; }

.fg__grid { row-gap: var(--mk-row-gap); }

/* the picture sits on the stage, cropped at the foot by the panel's own fade */
.fg__panel {
  --mk-stage-height: 300px;
  display: flex;
  justify-content: center;
  padding: var(--mk-space-lg) var(--mk-space-md) 0;
}
.fg__panel--low { align-items: flex-end; padding-block: 0 var(--mk-space-lg); }
.fg__panel--low::after { display: none; }
.fg__panel--flat { align-items: center; padding: var(--mk-space-sm); }
.fg__panel--flat::after { display: none; }

@media (min-width: 1024px) { .fg__panel { --mk-stage-height: 336px; } }

/* On a phone the pictures are illustrations, not evidence: show a slice. */
@media (max-width: 639px) {
  .fg__panel { --mk-stage-height: 180px; padding: var(--mk-space-sm) var(--mk-space-xs) 0; }
  .fg__panel--low { padding-block: 0 var(--mk-space-sm); }
  .fg__panel--flat { --mk-stage-height: 200px; }
}
</style>
