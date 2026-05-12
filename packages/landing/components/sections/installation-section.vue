<script setup lang="ts">
const { copied, copy } = useClipboard()

const installCmd = 'npx meowkit init'

const steps = [
  { num: '01', title: 'Install', code: 'npx meowkit init', desc: 'Scaffolds the harness into your project.' },
  { num: '02', title: 'Configure', code: 'npx meowkit setup', desc: 'Choose your workflow modes and agents.' },
  { num: '03', title: 'Run', code: '/ck:cook "add feature X"', desc: 'The 7-phase pipeline enforces the rest.' },
]

function handleCopy() {
  copy(installCmd)
}
</script>

<template>
  <section id="install" class="section-padding" aria-labelledby="install-heading">
    <div class="container-landing">
      <div class="install__header">
        <p class="install__eyebrow">Quick Start</p>
        <h2 id="install-heading" class="install__heading">
          One command to<br />
          <span class="gradient-text">enforce discipline</span>
        </h2>
      </div>

      <!-- Main install block -->
      <div class="install__block glass">
        <div class="install__cmd-row">
          <code class="install__cmd">{{ installCmd }}</code>
          <button
            class="install__copy"
            :class="{ 'install__copy--done': copied }"
            :aria-label="copied ? 'Copied!' : 'Copy install command'"
            @click="handleCopy"
          >
            <!-- Copy icon -->
            <svg v-if="!copied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <!-- Check icon -->
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="animate-sparkle">{{ copied ? 'Copied ✦' : 'Copy' }}</span>
          </button>
        </div>
      </div>

      <!-- Steps -->
      <ol class="install__steps" aria-label="Quick start steps">
        <li
          v-for="(step, i) in steps"
          :key="step.num"
          class="install__step glass"
          :style="{ '--i': i }"
        >
          <span class="install__step-num">{{ step.num }}</span>
          <div class="install__step-body">
            <h3 class="install__step-title">{{ step.title }}</h3>
            <code class="install__step-code">{{ step.code }}</code>
            <p class="install__step-desc">{{ step.desc }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.install__header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.install__eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.install__heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0;
}

.install__block {
  border-radius: var(--radius-lg, 16px);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
  max-width: 42rem;
  margin-left: auto;
  margin-right: auto;
}

.install__cmd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.install__cmd {
  font-family: "Fira Code", monospace;
  font-size: clamp(1rem, 2.5vw, 1.375rem);
  color: #99DDFF;
  word-break: break-all;
}

.install__copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: #94A3B8;
  font-size: 0.8125rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.install__copy:hover {
  border-color: rgba(102, 204, 255, 0.3);
  color: #F8FAFC;
}
.install__copy--done {
  border-color: rgba(102, 204, 255, 0.4);
  color: #66CCFF;
}

.install__steps {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  max-width: 42rem;
  margin: 0 auto;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .install__steps { grid-template-columns: repeat(3, 1fr); }
}

.install__step {
  border-radius: var(--radius-md, 10px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.install__step-num {
  font-family: "Fira Code", monospace;
  font-size: 0.75rem;
  color: rgba(102, 204, 255, 0.5);
}

.install__step-body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.install__step-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #F8FAFC;
  margin: 0;
}

.install__step-code {
  font-family: "Fira Code", monospace;
  font-size: 0.8125rem;
  color: #99DDFF;
  word-break: break-all;
}

.install__step-desc {
  font-size: 0.8125rem;
  color: #94A3B8;
  line-height: 1.55;
  margin: 0;
}
</style>
