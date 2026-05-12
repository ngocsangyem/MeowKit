<template>
  <a
    href="#features"
    class="scroll-indicator"
    aria-label="Scroll to features"
  >
    <span class="scroll-indicator__dot animate-bounce-slow" aria-hidden="true" />
  </a>
</template>

<style scoped>
.scroll-indicator {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  text-decoration: none;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}
.scroll-indicator:hover { opacity: 0.9; }

.scroll-indicator__dot {
  width: 24px;
  height: 38px;
  border: 2px solid rgba(102, 204, 255, 0.4);
  border-radius: 12px;
  position: relative;
}
.scroll-indicator__dot::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 8px;
  background: #66CCFF;
  border-radius: 2px;
  animation: scroll-dot 1.8s ease-in-out infinite;
}

@keyframes scroll-dot {
  0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
  50%       { transform: translateX(-50%) translateY(8px); opacity: 0.4; }
}
</style>
