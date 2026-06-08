import { safeStr } from "@/lib/data.helpers"

export {
  APP_ENV,
  APP_LOG_LEVEL,
  APP_NAME,
  APP_URL,
  INDEXER_URL,
  NETWORK_ENV,
  NETWORK_STORAGE_KEY,
  WALLET_CONNECT_ID,
} from "@hyperbridge-fe/shared/constants"

const env = import.meta.env // process.env

export const isProduction = env.MODE === "production"
export const isDevelopment = env.MODE === "development"
export const isAppStaging = env.VITE_APP_ENV === "staging"

export const MAINTENANCE_MODE = !isDevelopment && false

export const BRIDGING_PERCENTAGE: bigint = 1000n // <- 0.1 percent;

export const POSTHOG_API_KEY = safeStr(env.VITE_POSTHOG_KEY)
