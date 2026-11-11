<script setup lang="ts">
/* The Prompt + Cursor lockup: an ink `>` chevron, a blue cat-eared cursor block,
 * then the lowercase wordmark set live in JetBrains Mono. Geometry matches the
 * symbol master in assets/branding/meow-symbol.svg. */
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg', to?: string }>(), {
  size: 'md',
  to: '/',
})
</script>

<template>
  <NuxtLink :to="to" class="logo" :class="`logo--${size}`" aria-label="MeowKit home">
    <svg class="logo__mark" viewBox="14 54 228 158" aria-hidden="true" focusable="false">
      <path class="logo__chevron" d="M20 98l16-16 56 56-56 56-16-16 40-40z" />
      <path class="logo__cursor" d="M116 60l38 38h44l38-38v146H116z" />
    </svg>
    <span class="logo__word">meowkit</span>
  </NuxtLink>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.44em;
  font-family: var(--mk-font-mono);
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--mk-ink);
  text-decoration: none;
  white-space: nowrap;
}
.logo--sm { font-size: 1rem; }
.logo--md { font-size: 1.25rem; }
.logo--lg { font-size: 1.75rem; }

.logo__mark {
  flex: none;
  width: 1.45em;
  height: 1em;
  overflow: visible;
}
.logo__chevron { fill: currentColor; }
.logo__cursor { fill: var(--mk-accent); }

.logo__word { line-height: 1; }

/* On night surfaces the mark flips to paper ink and the lighter accent */
:global(.on-night) .logo,
.logo--night { color: var(--mk-night-ink); }
:global(.on-night) .logo__cursor,
.logo--night .logo__cursor { fill: var(--mk-sky); }

.logo:hover .logo__cursor { fill: var(--mk-ink); }
.logo--night:hover .logo__cursor { fill: var(--mk-night-ink); }
</style>
