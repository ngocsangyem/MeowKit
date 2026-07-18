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
      <button class="btn-fill" @click="handleError">Back to home</button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) var(--page-gutter);
}

.error-page__inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-md);
  text-align: left;
}

.error-page__code {
  font-family: var(--font-mono);
  font-size: var(--text-3xl);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--color-accent);
}

.error-page__heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-xl);
  letter-spacing: -0.02em;
  color: var(--color-ink);
  margin: 0;
}

.error-page__sub {
  font-size: var(--text-base);
  color: var(--color-muted);
  max-width: 44ch;
  margin: 0 0 var(--space-xs);
}
</style>
