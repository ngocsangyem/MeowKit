<script setup lang="ts">
// Skip entirely when user prefers reduced motion — improves accessibility and INP
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { start, stop, resize } = useParticles(canvasRef)

onMounted(() => {
  if (prefersReducedMotion.value) return
  const startWithResize = () => {
    start()
    window.addEventListener('resize', resize, { passive: true })
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(startWithResize, { timeout: 2000 })
  }
  else {
    setTimeout(startWithResize, 200)
  }
})

onUnmounted(() => {
  stop()
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas
    v-if="!prefersReducedMotion"
    ref="canvasRef"
    class="particles-canvas"
    aria-hidden="true"
  />
</template>

<style scoped>
.particles-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
}
</style>
