/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute or relative URL of the screen data endpoint. Defaults to `mock/example.json`. */
  readonly VITE_API_URL?: string
  /** Optional URL of the city screen endpoint (`#/city`). Defaults to `mock/city.json`. */
  readonly VITE_CITY_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
