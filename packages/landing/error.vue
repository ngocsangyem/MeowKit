<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; statusMessage?: string } }>()

useHead({ title: `${props.error.statusCode} — MeowKit` })

function handleError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-page">
    <div class="error-page__inner">
      <span class="error-page__code">{{ error.statusCode }}</span>
      <h1 class="error-page__heading">
        {{ error.statusCode === 404 ? 'Page not found' : 'Something went wrong' }}
      </h1>
      <p class="error-page__sub">
        {{ error.statusCode === 404
          ? "The page you're looking for doesn't exist."
          : error.statusMessage || 'An unexpected error occurred.' }}
      </p>
      <button class="mk-btn mk-btn--primary" @click="handleError">Back to home</button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--mk-space-2xl) var(--mk-rail);
}

.error-page__inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--mk-space-sm);
  text-align: left;
}

.error-page__code {
  font-family: var(--mk-font-mono);
  font-size: var(--mk-text-h1);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--mk-accent);
}

.error-page__heading {
  font-family: var(--mk-font-display);
  font-weight: var(--mk-serif-weight);
  font-size: var(--mk-text-h2);
  letter-spacing: var(--mk-serif-track);
  color: var(--mk-ink);
  margin: 0;
}

.error-page__sub {
  font-size: var(--mk-text-base);
  color: var(--mk-muted);
  max-width: 44ch;
  margin: 0 0 var(--mk-space-2xs);
}
</style>
