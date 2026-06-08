/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_APP_ENV?: string
  readonly VITE_APP_URL?: string
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_ANKR_API_KEY?: string
  readonly VITE_WALLETCONNECT_ID?: string
  readonly VITE_ALCHEMY_API_KEY?: string
  readonly VITE_MAINNET_INDEXER_URL?: string
  readonly VITE_TESTNET_INDEXER_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_GOOGLE_ANALYTICS_ID?: string
  readonly VITE_BRIDGE_APP_URL?: string
  readonly VITE_HYPERFX_APP_URL?: string
}
