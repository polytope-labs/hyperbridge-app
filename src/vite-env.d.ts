/// <reference types="vite/client" />
import "./shared/vite-env.d.ts"

declare global {
  interface Window {
    injectedWeb3?: Record<string, unknown>
  }
}

declare module "*.css" {
  const content: string
  export default content
}
