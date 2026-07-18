<template>
  <div class="comparison" role="group" aria-label="Before and after MeowKit comparison">
    <!-- Before -->
    <div class="comparison__panel code-frame">
      <p class="code-frame__label">Before</p>
      <pre aria-label="Without MeowKit"><code><span class="tok-comment"># No plan, no gates, no tests</span>
<span class="tok-keyword">claude</span> <span class="tok-string">"add user auth to the API"</span>

<span class="tok-comment"># AI ships code directly:</span>
<span class="tok-dim">✗ No approved spec</span>
<span class="tok-dim">✗ No failing tests first</span>
<span class="tok-dim">✗ No security scan</span>
<span class="tok-dim">✗ No review gate</span>
<span class="tok-dim">→ untested code in production</span></code></pre>
    </div>

    <!-- After -->
    <div class="comparison__panel code-frame">
      <p class="code-frame__label code-frame__label--accent">With MeowKit</p>
      <pre aria-label="With MeowKit"><code><span class="tok-comment"># Enforced 7-phase workflow</span>
<span class="tok-keyword">npx meowkit</span> <span class="tok-string">"add user auth"</span>

<span class="tok-comment"># Harness enforces:</span>
<span class="tok-ok">✓ Plan approved at Gate 1</span>
<span class="tok-ok">✓ Tests written first (TDD)</span>
<span class="tok-ok">✓ Security scan — no BLOCKs</span>
<span class="tok-ok">✓ Review passed at Gate 2</span>
<span class="tok-ok">→ production-quality PR</span></code></pre>
    </div>
  </div>
</template>

<style scoped>
.comparison {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-lg);
}

.code-frame__label--accent {
  color: var(--color-accent);
}

.tok-comment { color: var(--color-muted); }
.tok-keyword { color: var(--color-ink); }
.tok-string { color: var(--color-ink-2); }
.tok-dim { color: var(--color-muted); }
.tok-ok { color: var(--color-accent); }
</style>
