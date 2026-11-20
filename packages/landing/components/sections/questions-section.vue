<script setup lang="ts">
/* Section 5 — the questions. Revised for 3.0.0; the answers are
 * always open, so the section's height never jumps. */
const faq = [
  { q: 'What does MeowKit cost?', a: 'Nothing. MeowKit is open source under the MIT licence.' },
  { q: 'What does MeowKit add to a repository?', a: 'Two directories on Claude Code, .claude and .meowkit. The other runtimes add their own files. The core workflow has no external dependencies.' },
  { q: 'Does MeowKit work outside Claude Code?', a: 'Yes. One kit installs on Claude Code, Codex, Cursor, Grok, Pi and OMP with mewkit init --target. Grok, Pi and OMP install at project scope only, and their enforcement has not been run in a live session yet.' },
  { q: 'Does MeowKit stop an edit or a commit?', a: 'Only the ship check does: lint, related tests and a type-check run on git commit, push, merge and gh pr create, and the command is refused when one fails. Planning and review are practices, so no hook blocks an edit without a plan or a commit without a review verdict.' },
  { q: 'Does MeowKit require tests first?', a: 'No. Test-first is opt-in with the --tdd flag; verification runs on every task either way.' },
  { q: 'Where does MeowKit keep its plans?', a: 'Under tasks/plans, one dated folder a task, with plan.md and a file for each phase.' },
]
</script>

<template>
  <section class="mk-section" id="questions" aria-labelledby="questions-h">
    <div class="mk-wrap mk-grid">
      <div class="mk-col-5 mk-flow mk-flow--roomy qs__intro">
        <h2 id="questions-h">Questions</h2>
        <p class="mk-dim">The longer answers are in the docs.</p>
        <p><a class="mk-link" href="https://docs.meowkit.dev/">Read the docs</a></p>
      </div>

      <dl class="mk-col-6 mk-col-start-7 qs__list">
        <div v-for="item in faq" :key="item.q" class="qs__item">
          <dt class="qs__q">{{ item.q }}</dt>
          <dd class="qs__a">{{ item.a }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.qs__intro { align-self: start; }

.qs__list { margin: 0; }

.qs__item { padding-block: var(--mk-space-md); border-top: 1px solid var(--mk-line); }
.qs__item:first-child { border-top: 0; padding-top: 0; }

.qs__q {
  font-family: var(--mk-font-sans);
  font-weight: 500;
  font-size: var(--mk-text-title);
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--mk-ink);
}
.qs__a { margin: var(--mk-space-2xs) 0 0; max-width: 56ch; color: var(--mk-ink); }

@media (max-width: 899px) {
  .qs__intro { margin-block-end: var(--mk-head-offset); }
  .qs__item:first-child { border-top: 1px solid var(--mk-line); padding-top: var(--mk-space-md); }
}
</style>
