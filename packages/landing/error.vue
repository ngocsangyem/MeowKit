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
      <span class="error-page__code gradient-text">{{ error.statusCode }}</span>
      <h1 class="error-page__heading">
        {{ error.statusCode === 404 ? 'Page not found' : 'Something went wrong' }}
      </h1>
      <p class="error-page__sub">
        {{ error.statusCode === 404
          ? "The page you're looking for doesn't exist."
          : error.statusMessage || 'An unexpected error occurred.' }}
      </p>
      <button class="btn-primary" @click="handleError">Back to home</button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.error-page__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.error-page__code {
  font-size: 6rem;
  font-weight: 500;
  line-height: 1;
  font-family: "Fira Code", monospace;
}

.error-page__heading {
  font-size: 1.5rem;
  font-weight: 500;
  color: #F8FAFC;
  margin: 0;
}

.error-page__sub {
  font-size: 1rem;
  color: #94A3B8;
  max-width: 28rem;
  margin: 0 0 0.5rem;
}
</style>
