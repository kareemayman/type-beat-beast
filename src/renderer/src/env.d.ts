import type { Api } from '../../shared/api'

// Tells TypeScript that the preload put `window.api` on the page.
declare global {
  interface Window {
    api: Api
  }
}
