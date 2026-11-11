<script setup lang="ts">
/* Section 2 — the seven phases, told as one task's run. Copy verbatim from the mockup. */
</script>

<template>
  <section class="mk-section" id="workflow" aria-labelledby="workflow-h">
    <div class="mk-wrap">
      <div class="mk-grid wf__head">
        <h2 class="mk-col-5" id="workflow-h">The MeowKit workflow has seven phases</h2>
        <p class="mk-col-6 mk-col-start-7 wf__lede">
          A task is planned, built, simplified, verified and reviewed in that order. The run stops
          at Gate 1 before any source edit and at Gate 2 before any commit.
          <a class="mk-link" href="https://docs.meowkit.dev/">Read the gate rules</a>
        </p>
      </div>

      <div
        class="wf__app mk-reveal"
        role="img"
        aria-label="MeowKit task list beside one task's run: plan approved, build done, verify running, review and ship waiting"
      >
        <div class="wf__pane wf__pane--list"><TaskBoard /></div>
        <div class="wf__pane wf__pane--open"><PipelineBoard /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wf__head { margin-block-end: var(--mk-head-offset); }
.wf__lede { font-size: var(--mk-text-lead); line-height: 1.5; color: var(--mk-ink); }

.wf__app {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-card);
  background: var(--mk-surface);
  box-shadow: var(--mk-lift-card);
  overflow: hidden;
}

.wf__pane { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.wf__pane + .wf__pane { border-left: 1px solid var(--mk-line-soft); }

/* the list runs under a fade so it reads as a longer list than the frame shows */
.wf__pane--list { max-height: 560px; }
.wf__pane--list::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 64px;
  background: linear-gradient(transparent, var(--mk-surface));
  pointer-events: none;
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .wf__app { grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); }
}

@media (max-width: 1023px) {
  .wf__app { grid-template-columns: minmax(0, 1fr); }
  .wf__pane--list { max-height: 260px; }
  .wf__pane + .wf__pane { border-left: 0; border-top: 1px solid var(--mk-line-soft); }
}

/* On a phone the list pane adds nothing the run does not say: drop it rather
 * than squeeze four columns into 342px. */
@media (max-width: 639px) {
  .wf__pane--list { display: none; }
  .wf__pane + .wf__pane { border-top: 0; }
}
</style>
