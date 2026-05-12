<script setup lang="ts">
const canvasRef = ref<HTMLCanvasElement | null>(null)
// Must call in setup context so useMouse() inside useParticles works correctly
const { start, stop, resize } = useParticles(canvasRef)

onMounted(() => {
  start()
  window.addEventListener('resize', resize, { passive: true })
})

onUnmounted(() => {
  stop()
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas
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
