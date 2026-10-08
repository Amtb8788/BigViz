<template>
  <ul class="bv-kpis" :style="{ '--n': items.length, '--start': `${ENTRANCE.kpis}s` }">
    <li v-for="(item, i) in items" :key="item.id" class="bv-kpi" :style="{ '--i': i }">
      <!-- Outer span carries the pop-in, the image floats: two transforms never fight -->
      <span v-if="item.icon" class="bv-kpi__icon-wrap" aria-hidden="true">
        <img
          class="bv-kpi__icon"
          :src="item.icon.src"
          :width="item.icon.width"
          :height="item.icon.height"
          :style="iconStyle(item)"
          alt=""
          loading="eager"
        />
      </span>
      <div class="bv-kpi__info">
        <div class="bv-kpi__label">{{ item.label }}</div>
        <div class="bv-kpi__value">
          <CountUp
            :value="item.value"
            :decimals="item.decimals ?? 0"
            :delay="ENTRANCE.kpis + i * 0.1"
            :locale="locale"
          /><small v-if="item.unit">{{ item.unit }}</small>
        </div>
        <div v-if="item.delta !== undefined" class="bv-kpi__delta">
          {{ item.deltaLabel }}
          <span :class="item.delta >= 0 ? 'is-up' : 'is-down'">
            <span class="bv-kpi__arrow" aria-hidden="true">{{ item.delta >= 0 ? '↑' : '↓' }}</span>
            <span class="bv-sr-only">{{ item.delta >= 0 ? '+' : '-' }}</span>{{ Math.abs(item.delta) }}%
          </span>
        </div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
// KPI strip: icon + value + optional change vs. previous period. Icon geometry comes from the
// asset manifest (aspect + trim), so the visible artwork, not the PNG box, is what gets spaced.
import type { KpiItem } from './types'
import CountUp from './CountUp.vue'
import { ENTRANCE } from './motion'

withDefaults(defineProps<{ items: KpiItem[]; locale?: string }>(), { locale: 'en-US' })

/**
 * The icon is sized by height (`--icon`); width follows the real aspect. Transparent margins from
 * the manifest are cancelled with negative margins so gaps are measured from the visible shape.
 */
const iconStyle = (item: KpiItem) => {
  const icon = item.icon
  if (!icon) return {}
  return {
    '--aspect': icon.aspect,
    '--tl': icon.trim.l,
    '--tr': icon.trim.r,
    '--tt': icon.trim.t,
    '--tb': icon.trim.b
  }
}
</script>

<style scoped>
.bv-kpis {
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  gap: 18px;
  height: 100%;
  padding: 0;
  margin: 0;
  list-style: none;
  container-type: inline-size;
}

/* Icon + text centred as a group; shrinks when the centre column narrows (squarer screens) */
.bv-kpi {
  position: relative;
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 18px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--bv-panel-top), var(--bv-panel-bottom));
  border: 1px solid var(--bv-line);
  border-radius: 6px;
  box-shadow: inset 0 0 18px color-mix(in srgb, var(--bv-primary) 30%, transparent);
  animation: bv-kpi-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--start) + var(--i) * 0.1s) both;
}

/* Glass sheen: sweeps during the first ~18 % of the cycle, cards offset by ~2 s */
.bv-kpi::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  pointer-events: none;
  content: '';
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bv-accent) 16%, transparent), transparent);
  transform: translateX(-160%) skewX(-24deg);
  animation: bv-kpi-sheen 8.3s ease-in-out calc(var(--i) * 2.1s + 2.4s) infinite;
}

.bv-kpi__icon-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  animation: bv-kpi-pop 0.7s cubic-bezier(0.34, 1.8, 0.64, 1) calc(var(--start) + var(--i) * 0.1s + 0.2s) both;
}

/* Halo breathing behind the icon */
.bv-kpi__icon-wrap::before {
  position: absolute;
  inset: -6px;
  pointer-events: none;
  content: '';
  background: radial-gradient(circle, color-mix(in srgb, var(--bv-accent) 40%, transparent) 0, transparent 68%);
  border-radius: 50%;
  opacity: 0.4;
  animation: bv-kpi-halo 3.9s ease-in-out calc(var(--i) * -0.9s) infinite;
}

.bv-kpi__icon {
  --icon: 88px;

  position: relative;
  display: block;
  width: calc(var(--icon) * var(--aspect, 1));
  height: var(--icon);
  margin: calc(var(--icon) * var(--tt, 0) * -1) calc(var(--icon) * var(--aspect, 1) * var(--tr, 0) * -1)
    calc(var(--icon) * var(--tb, 0) * -1) calc(var(--icon) * var(--aspect, 1) * var(--tl, 0) * -1);
  animation: bv-kpi-float 4.7s ease-in-out calc(var(--i) * -1.3s) infinite;
}

.bv-kpi__info {
  min-width: 0;
  color: var(--bv-text);
  white-space: nowrap;
}

.bv-kpi__label {
  overflow: hidden;
  font-size: 17px;
  color: var(--bv-text-dim);
  text-overflow: ellipsis;
}

.bv-kpi__value {
  margin: 6px 0 7px;
  font-family: var(--bv-font-number);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 0 10px var(--bv-glow);
}

.bv-kpi__value small {
  margin-left: 5px;
  font-size: 16px;
  font-weight: 400;
}

.bv-kpi__delta {
  font-size: 15px;
  color: var(--bv-text-dim);
}

.bv-kpi__delta .is-up {
  color: var(--bv-ok);
}

.bv-kpi__delta .is-down {
  color: var(--bv-danger);
}

.bv-kpi__arrow {
  display: inline-block;
}

@keyframes bv-kpi-in {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes bv-kpi-pop {
  from {
    transform: scale(0) rotate(-120deg);
  }

  to {
    transform: none;
  }
}

@keyframes bv-kpi-float {
  0%,
  100% {
    transform: translateY(-4px);
  }

  50% {
    transform: translateY(4px);
  }
}

@keyframes bv-kpi-halo {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }

  50% {
    opacity: 0.85;
    transform: scale(1.12);
  }
}

@keyframes bv-kpi-sheen {
  0% {
    transform: translateX(-160%) skewX(-24deg);
  }

  18%,
  100% {
    transform: translateX(360%) skewX(-24deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bv-kpi,
  .bv-kpi::after,
  .bv-kpi__icon-wrap,
  .bv-kpi__icon-wrap::before,
  .bv-kpi__icon {
    animation: none;
  }

  .bv-kpi::after {
    opacity: 0;
  }
}

/* At 1920 the centre column is ~880 px wide, so this step is the default layout */
@container (max-width: 1000px) {
  .bv-kpi {
    gap: 12px;
    padding: 0 8px;
  }

  .bv-kpi__icon {
    --icon: 62px;
  }

  .bv-kpi__label {
    font-size: 15px;
  }

  .bv-kpi__value {
    margin: 5px 0 6px;
    font-size: 25px;
  }

  .bv-kpi__value small {
    font-size: 14px;
  }

  .bv-kpi__delta {
    font-size: 13px;
  }
}
</style>
