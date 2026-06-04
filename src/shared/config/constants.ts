import type { LogLevels } from "consola"
import { isDevelopment } from "std-env"
import { safeStr } from "@/lib/data.helpers"
import type { AppEnv } from "@/types"

export type LogLevel = keyof typeof LogLevels

export { isDevelopment, isProduction } from "std-env"

if (!("process" in globalThis)) {
  // @ts-expect-error
  globalThis.process = {
    env: {},
  }
}

const env = (key: string, next_config?: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return safeStr(import.meta.env[`VITE_${key}`])
  }

  return safeStr(next_config, "")
}

export const APP_NAME = "HYPERBRIDGE"

export const APP_ENV: AppEnv = safeStr(
  env("APP_ENV", process.env.NEXT_PUBLIC_APP_ENV),
  "production",
) as AppEnv

function resolvePublicAppUrl(): string {
  if (APP_ENV === "production") {
    return "https://app.hyperbridge.network"
  }

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const e = import.meta.env
    const raw =
      safeStr(e.VERCEL_BRANCH_URL) || safeStr(e.VITE_VERCEL_BRANCH_URL)
    if (raw) {
      const trimmed = raw.replace(/^https?:\/\//, "").replace(/\/$/, "")
      const local =
        trimmed.startsWith("localhost") || trimmed.startsWith("127.")
      return `${local ? "http" : "https"}://${trimmed}`
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  return "https://app-staging.hyperbridge.network"
}

export const APP_URL = resolvePublicAppUrl()

export const APP_LOG_LEVEL: LogLevel = env("LOG_LEVEL")
  ? (env("LOG_LEVEL") as LogLevel)
  : "info"

export const ANKR_API_KEY = env(
  "ANKR_API_KEY",
  process.env.NEXT_PUBLIC_ANKR_API_KEY,
)
export const WALLET_CONNECT_ID = env(
  "WALLETCONNECT_ID",
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
)
export const ALCHEMY_API_KEY = env(
  "ALCHEMY_API_KEY",
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
)
export const INFURA_API_KEY = env(
  "INFURA_API_KEY",
  process.env.NEXT_PUBLIC_INFURA_API_KEY,
)

export const INDEXER_URL = {
  mainnet: env("MAINNET_INDEXER_URL"),
  testnet: env("TESTNET_INDEXER_URL"),
}

export const NETWORK_STORAGE_KEY = "hyperbridge_app_network_env"

export const NETWORK_ENV = (function readEnv(): "mainnet" | "testnet" {
  const default_mode = isDevelopment ? "testnet" : "mainnet"

  if (typeof window === "undefined") return default_mode

  if (localStorage.getItem("temp_env") !== null) {
    localStorage.removeItem("temp_env")
  }

  const value = localStorage.getItem(NETWORK_STORAGE_KEY)
  if (value === null) return default_mode

  const parsed = String(value).trim()

  return parsed === "mainnet" || parsed === "testnet" ? parsed : "testnet"
})()

// value for a zero address
export const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000"
