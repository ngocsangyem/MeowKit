<script setup lang="ts">
const { copied, copy } = useClipboard()

const installCmd = 'npx mewkit init'

function handleCopy() {
  copy(installCmd)
}
</script>

<template>
  <section id="install" class="install" aria-labelledby="install-heading">
    <div class="container-landing">
      <div class="section-head">
        <h2 id="install-heading" class="section-head__title">
          One command to enforce discipline.
        </h2>
      </div>

      <!-- Terminal-true quick start: real commands, typographic frame, no fake chrome -->
      <div class="code-frame install__frame">
        <div class="install__frame-head">
          <p class="code-frame__label">Quick start</p>
          <button
            class="install__copy"
            :class="{ 'install__copy--done': copied }"
            :aria-label="copied ? 'Copied' : 'Copy install command'"
            @click="handleCopy"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <pre aria-label="Quick start commands"><code><span class="tok-prompt">$</span> <span class="tok-cmd">npx mewkit init</span>          <span class="tok-comment"># scaffold the harness into your project</span>
<span class="tok-prompt">$</span> <span class="tok-cmd">npx mewkit setup</span>        <span class="tok-comment"># choose your workflow modes and agents</span>
<span class="tok-prompt">$</span> <span class="tok-cmd">/mk:cook "add feature X"</span> <span class="tok-comment"># the 7-phase pipeline enforces the rest</span><span class="install__caret" aria-hidden="true">▮</span></code></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.install {
  padding-block: var(--space-3xl);
}

.install__frame {
  max-width: 48rem;
}

.install__frame-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
}

.install__copy {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: var(--space-2xs) var(--space-sm);
  border: var(--rule-hair) solid var(--color-rule);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--dur-short) var(--ease-out),
              color var(--dur-short) var(--ease-out);
}
.install__copy:hover {
  border-color: var(--color-accent);
  color: var(--color-ink);
}
.install__copy:active {
  transform: translateY(1px);
}
.install__copy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.install__copy--done {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tok-prompt { color: var(--color-accent); }
.tok-cmd { color: var(--color-ink); }
.tok-comment { color: var(--color-muted); }

.install__caret {
  display: inline-block;
  width: 1ch;
  color: var(--color-accent);
  animation: caret-blink 1s steps(2) infinite;
}

@keyframes caret-blink {
  50% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .install__caret { animation: none; }
}
</style>
