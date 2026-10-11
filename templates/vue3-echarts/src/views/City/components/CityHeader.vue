<template>
  <header class="ct-header">
    <div class="ct-header__side">
      <svg class="ct-logo" viewBox="0 0 40 40" width="40" height="40" role="img" :aria-label="t.logoAlt">
        <path d="M5 34h30M9 34V18h6v16M17 34V8h7v26M26 34V14h6v20" class="ct-logo__city" />
        <circle cx="20.5" cy="5" r="2" class="ct-logo__beacon" />
      </svg>
      <span class="ct-project">{{ project }}</span>
    </div>
    <h1 class="ct-title">{{ t.title }}</h1>
    <div class="ct-header__side ct-header__side--right">
      <time class="ct-time" :datetime="clock.iso">{{ clock.hms }}</time>
      <span class="ct-date">{{ clock.date }} {{ clock.week }}</span>
      <button type="button" class="ct-lang" :aria-label="t.switchLabel" @click="toggle">{{ t.switchTo }}</button>
    </div>
  </header>
</template>

<script setup lang="ts">
// City screen header: project name, title, live clock and the language toggle.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from '../i18n'

defineProps<{ project: string }>()

const { t, tag, toggle } = useI18n()

const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const pad = (n: number) => String(n).padStart(2, '0')
const clock = computed(() => {
  const d = now.value
  return {
    iso: d.toISOString(),
    hms: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    week: new Intl.DateTimeFormat(tag.value, { weekday: 'long' }).format(d)
  }
})
</script>

<style scoped>
.ct-header {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 90px;
  padding: 6px 32px 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bv-bg0) 85%, transparent), transparent);
  animation: ct-header-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Glowing bottom rule, brighter in the middle */
.ct-header::after {
  position: absolute;
  right: 0;
  bottom: 6px;
  left: 0;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, transparent, var(--bv-accent) 32%, var(--bv-accent) 68%, transparent);
  box-shadow: 0 0 10px var(--bv-accent);
}

.ct-header__side {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 560px;
}

.ct-header__side--right {
  gap: 18px;
  justify-content: flex-end;
}

.ct-logo {
  flex: none;
}

.ct-logo__city {
  fill: none;
  stroke: var(--bv-accent);
  stroke-width: 2.2;
  stroke-linejoin: round;
}

.ct-logo__beacon {
  fill: var(--bv-warn);
}

.ct-project {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
  text-shadow: 0 0 8px var(--bv-glow);
}

.ct-title {
  flex: 1;
  margin: 0;
  font-size: 44px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  letter-spacing: 4px;
  white-space: nowrap;
  background: linear-gradient(180deg, var(--bv-text) 30%, color-mix(in srgb, var(--bv-accent) 60%, var(--bv-text)) 100%);
  filter: drop-shadow(0 0 10px var(--bv-glow));
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ct-time {
  font-family: var(--bv-font-number);
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ct-date {
  font-size: 17px;
  color: var(--bv-text-dim);
  white-space: nowrap;
}

.ct-lang {
  min-width: 52px;
  padding: 4px 10px;
  font: inherit;
  font-size: 14px;
  color: var(--bv-text);
  cursor: pointer;
  background: color-mix(in srgb, var(--bv-primary) 25%, transparent);
  border: 1px solid var(--bv-line);
  border-radius: 4px;
}

.ct-lang:hover {
  background: color-mix(in srgb, var(--bv-primary) 45%, transparent);
}

.ct-lang:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 2px;
}

@keyframes ct-header-in {
  from {
    opacity: 0;
    transform: translateY(-40px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ct-header {
    animation: none;
  }
}
</style>
