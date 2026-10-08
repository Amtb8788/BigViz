<template>
  <!-- Decorative background: breathing centre glow, rising particles, vertical scan line -->
  <div class="ex-ambient" aria-hidden="true">
    <div class="ex-ambient__glow" />
    <i
      v-for="p in PARTICLES"
      :key="p.id"
      class="ex-ambient__dot"
      :style="{
        left: `${p.x}%`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        animationDuration: `${p.duration}s`,
        animationDelay: `-${p.delay}s`
      }"
    />
    <div class="ex-ambient__scan" />
  </div>
</template>

<script setup lang="ts">
// Ambient background layer. Fixed-seed particles (no jumping between renders), capped at 36.
const PARTICLES = Array.from({ length: 36 }, (_, id) => {
  const r = (k: number) => (((Math.sin(id * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1
  return { id, x: r(1) * 100, size: 2 + r(2) * 3, duration: 14 + r(3) * 16, delay: r(4) * 30 }
})
</script>

<style scoped>
.ex-ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.ex-ambient__glow {
  position: absolute;
  top: 20%;
  left: 50%;
  width: 1100px;
  height: 800px;
  margin-left: -550px;
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--bv-primary) 22%, transparent), transparent 65%);
  animation: ex-breathe 7.3s ease-in-out infinite;
}

.ex-ambient__dot {
  position: absolute;
  bottom: -10px;
  background: var(--bv-accent);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--bv-accent);
  opacity: 0;
  animation: ex-rise linear infinite;
}

.ex-ambient__scan {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 160px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--bv-accent) 7%, transparent) 85%,
    color-mix(in srgb, var(--bv-accent) 22%, transparent)
  );
  transform: translateY(-200px);
  animation: ex-scan 11.7s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

@keyframes ex-breathe {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes ex-rise {
  0% {
    opacity: 0;
    transform: translateY(0);
  }

  15% {
    opacity: 0.8;
  }

  70% {
    opacity: 0.4;
  }

  100% {
    opacity: 0;
    transform: translateY(-900px);
  }
}

@keyframes ex-scan {
  0% {
    transform: translateY(-200px);
  }

  60%,
  100% {
    transform: translateY(1300px);
  }
}

/* Reduced motion: keep a static glow, drop particles and scan */
@media (prefers-reduced-motion: reduce) {
  .ex-ambient__glow {
    opacity: 0.8;
    animation: none;
  }

  .ex-ambient__dot,
  .ex-ambient__scan {
    display: none;
  }
}
</style>
