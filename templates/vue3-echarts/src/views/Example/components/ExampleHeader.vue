<template>
  <header class="ex-header">
    <div class="ex-header__side">
      <svg class="ex-logo" viewBox="0 0 40 40" width="40" height="40" role="img" :aria-label="t.logoAlt">
        <path d="M20 3 35 9v11c0 9-6.5 15-15 17C11.5 35 5 29 5 20V9z" class="ex-logo__shield" />
        <path d="m13 20 5 5 9-10" class="ex-logo__check" />
      </svg>
      <span class="ex-project">{{ project }}</span>
    </div>
    <h1 class="ex-title">{{ t.title }}</h1>
    <div class="ex-header__side ex-header__side--right">
      <time class="ex-time" :datetime="clock.iso">
        {{ clock.hm }}<i class="ex-time__colon" aria-hidden="true">:</i>
        <Transition name="ex-tick" mode="out-in">
          <span :key="clock.s" class="ex-time__sec">{{ clock.s }}</span>
        </Transition>
      </time>
      <span class="ex-date">{{ clock.date }} {{ clock.week }}</span>
      <button type="button" class="ex-lang" :aria-label="t.switchLabel" @click="toggle">{{ t.switchTo }}</button>
    </div>
    <i class="ex-header__beam" aria-hidden="true" />
  </header>
</template>

<script setup lang="ts">
// Screen header: project name, title with a periodic shine, live clock and a language toggle.
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
    hm: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    s: pad(d.getSeconds()),
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    week: new Intl.DateTimeFormat(tag.value, { weekday: 'long' }).format(d)
  }
})
</script>

<style scoped>
.ex-header {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 90px;
  padding: 6px 32px 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bv-primary) 40%, transparent), transparent);
  animation: ex-header-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Glowing bottom rule */
.ex-header::after {
  position: absolute;
  right: 0;
  bottom: 6px;
  left: 0;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, transparent, var(--bv-accent) 30%, var(--bv-accent) 70%, transparent);
  box-shadow: 0 0 10px var(--bv-accent);
}

.ex-header__side {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 560px;
}

.ex-header__side--right {
  gap: 18px;
  justify-content: flex-end;
}

/* Highlight cruising along the bottom rule; the element is full width and moves by its own % */
.ex-header__beam {
  position: absolute;
  right: 0;
  bottom: 4px;
  left: 0;
  height: 6px;
  pointer-events: none;
  background: radial-gradient(ellipse at center, #e6f7ff 0%, var(--bv-accent) 35%, transparent 70%) center / 240px 6px
    no-repeat;
  opacity: 0;
  animation: ex-beam 6.3s ease-in-out 2.4s infinite;
}

.ex-logo {
  flex: none;
}

.ex-logo__shield {
  fill: color-mix(in srgb, var(--bv-primary) 35%, transparent);
  stroke: var(--bv-accent);
  stroke-width: 2;
}

.ex-logo__check {
  fill: none;
  stroke: var(--bv-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.ex-project {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
  text-shadow: 0 0 8px var(--bv-glow);
}

/* Static gradient text. (A moving shine would need background-position animation, which repaints;
   the kit only animates transform and opacity.) */
.ex-title {
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

.ex-time {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--bv-font-number);
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ex-time__colon {
  font-style: normal;
  animation: ex-blink 2s steps(1) infinite;
}

.ex-time__sec {
  display: inline-block;
  min-width: 1.1em;
  color: var(--bv-accent);
}

.ex-date {
  font-size: 17px;
  color: var(--bv-text-dim);
  white-space: nowrap;
}

.ex-lang {
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

.ex-lang:hover {
  background: color-mix(in srgb, var(--bv-primary) 45%, transparent);
}

.ex-lang:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 2px;
}

/* Seconds tick: old value slides up and out, new one slides in from below */
.ex-tick-enter-active,
.ex-tick-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.ex-tick-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.ex-tick-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes ex-header-in {
  from {
    opacity: 0;
    transform: translateY(-40px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes ex-beam {
  0% {
    opacity: 0;
    transform: translateX(-36%);
  }

  15%,
  85% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateX(36%);
  }
}

@keyframes ex-blink {
  50% {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ex-header,
  .ex-time__colon {
    animation: none;
  }

  .ex-header__beam {
    display: none;
  }

  .ex-tick-enter-active,
  .ex-tick-leave-active {
    transition: none;
  }
}
</style>
