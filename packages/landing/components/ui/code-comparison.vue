<template>
  <div class="comparison" role="group" aria-label="Before and after MeowKit comparison">
    <!-- Before -->
    <div class="comparison__panel glass">
      <div class="comparison__label comparison__label--before">Before</div>
      <pre class="comparison__code" aria-label="Without MeowKit"><code><span class="tok-comment"># No plan, no gates, no tests</span>
<span class="tok-keyword">claude</span> <span class="tok-string">"add user auth to the API"</span>

<span class="tok-comment"># AI ships code directly:</span>
<span class="tok-dim">✗ No approved spec</span>
<span class="tok-dim">✗ No failing tests first</span>
<span class="tok-dim">✗ No security scan</span>
<span class="tok-dim">✗ No review gate</span>
<span class="tok-dim">→ untested code in production</span></code></pre>
    </div>

    <!-- Divider -->
    <div class="comparison__divider" aria-hidden="true">
      <span class="comparison__divider-icon">✦</span>
    </div>

    <!-- After -->
    <div class="comparison__panel glass">
      <div class="comparison__label comparison__label--after">With MeowKit</div>
      <pre class="comparison__code" aria-label="With MeowKit"><code><span class="tok-comment"># Enforced 7-phase workflow</span>
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
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: center;
}

@media (min-width: 768px) {
  .comparison {
    grid-template-columns: 1fr auto 1fr;
  }
}

.comparison__panel {
  border-radius: var(--radius-md, 10px);
  padding: 1.5rem;
}

.comparison__label {
  font-family: "Fira Code", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.875rem;
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  display: inline-block;
}

.comparison__label--before {
  color: #94A3B8;
  background: rgba(255, 255, 255, 0.04);
}

.comparison__label--after {
  color: #66CCFF;
  background: rgba(102, 204, 255, 0.08);
}

.comparison__code {
  margin: 0;
  font-family: "Fira Code", monospace;
  font-size: 0.8125rem;
  line-height: 1.7;
  overflow-x: auto;
  color: #94A3B8;
}

.comparison__divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.comparison__divider-icon {
  font-size: 1.25rem;
  color: rgba(102, 204, 255, 0.4);
}

:deep(.tok-comment) { color: rgba(148, 163, 184, 0.5); }
:deep(.tok-keyword)  { color: #85C2FF; }
:deep(.tok-string)   { color: #99DDFF; }
:deep(.tok-dim)      { color: rgba(148, 163, 184, 0.45); }
:deep(.tok-ok)       { color: rgba(102, 204, 255, 0.85); }
</style>
