<template>
  <component :is="view" />
</template>

<script setup lang="ts">
// App shell: picks the screen from `location.hash` (no router needed). `#/city` → the 3D city
// screen, anything else → the example screen. Each screen is its own lazy chunk, so the example
// never downloads three.js. Replace with vue-router if you add more screens.
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'

const ExampleScreen = defineAsyncComponent(() => import('./views/Example/index.vue'))
const CityScreen = defineAsyncComponent(() => import('./views/City/index.vue'))

const ROUTES: Record<string, typeof ExampleScreen> = { '#/city': CityScreen }

const hash = ref(location.hash)
const onHash = () => (hash.value = location.hash)
window.addEventListener('hashchange', onHash)
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))

const view = computed(() => ROUTES[hash.value.replace(/\/$/, '')] ?? ExampleScreen)
</script>
