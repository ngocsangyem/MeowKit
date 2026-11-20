<script setup lang="ts">
/* Section 6 — install the binary, then init. The install command is copyable;
 * Windows users follow the docs link to the PowerShell installer. */
const COMMAND = 'curl -fsSL https://raw.githubusercontent.com/ngocsangyem/MeowKit/main/install.sh | sh'
const { copied, copy } = useClipboard()
</script>

<template>
  <section class="mk-section" id="install" aria-labelledby="install-h">
    <div class="mk-wrap mk-grid">
      <div class="mk-col-5 mk-flow mk-flow--roomy in__copy">
        <h2 id="install-h">Install MeowKit in two commands</h2>

        <p class="mk-lead">
          Install the <code>mewkit</code> binary with
          <button
            class="in__cmd"
            type="button"
            :aria-label="copied ? `Copied ${COMMAND} to the clipboard` : `Copy ${COMMAND}`"
            @click="copy(COMMAND)"
          >
            <code>{{ COMMAND }}</code>
            <span class="in__cmd-hint" aria-hidden="true">{{ copied ? 'Copied' : 'Copy' }}</span>
          </button>
          <!-- the visual label is decorative; the result is announced here -->
          <span class="mk-sr-only" role="status" aria-live="polite">
            {{ copied ? `Copied ${COMMAND} to the clipboard` : '' }}
          </span>
          then run <code>mewkit init</code> in a project. It fetches the latest kit release, checks it and writes two directories.
        </p>

        <p class="mk-dim">.claude holds the skills, agents, rules and hooks.</p>
        <p class="mk-dim">.meowkit holds memory, state and config.</p>
        <p class="mk-dim">Add <code>--target codex</code>, <code>cursor</code>, <code>grok</code>, <code>pi</code>, <code>omp</code> or <code>all</code> to choose runtimes.</p>
        <p><a class="mk-link" href="https://docs.meowkit.dev/">Read the quick start</a></p>
      </div>

      <div class="mk-col-6 mk-col-start-7 in__frame mk-reveal">
        <TerminalRun />
      </div>
    </div>
  </section>
</template>

<style scoped>
.in__copy { align-self: center; }

.in__cmd {
  display: inline-flex;
  align-items: center;
  gap: var(--mk-space-2xs);
  vertical-align: baseline;
  padding: 2px var(--mk-space-2xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-chip);
  background: var(--mk-surface);
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: background-color var(--mk-dur-base) var(--mk-ease);
}
.in__cmd:hover { background: var(--mk-haze); }
/* the install command carries a long URL; let it break anywhere so a phone never scrolls sideways */
.in__cmd { max-width: 100%; text-align: left; }
.in__cmd code { font-family: var(--mk-font-mono); font-size: 0.9em; color: var(--mk-ink); background: none; overflow-wrap: anywhere; min-width: 0; }

/* Muted is 4.99:1 on the resting surface — fine for a caption — but only
 * 4.18:1 once hover deepens the ground to haze, so the hint takes ink there.
 * 12px is the floor for this label; 11px was below it. */
.in__cmd-hint {
  font-family: var(--mk-font-mono);
  font-size: 0.75rem;
  color: var(--mk-muted);
  transition: color var(--mk-dur-base) var(--mk-ease);
}
.in__cmd:hover .in__cmd-hint,
.in__cmd:focus-visible .in__cmd-hint { color: var(--mk-ink); }

/* the terminal sits on the haze stage, cropped at the foot like the feature panels */
.in__frame {
  display: flex;
  justify-content: center;
  padding: var(--mk-space-xl) var(--mk-space-md) 0;
  border-radius: var(--mk-radius-card);
  background: var(--mk-haze);
  overflow: hidden;
}

@media (max-width: 899px) {
  .in__copy { margin-block-end: var(--mk-head-offset); }
}
@media (max-width: 639px) {
  .in__frame { padding: var(--mk-space-md) var(--mk-space-xs) 0; }
}
</style>
