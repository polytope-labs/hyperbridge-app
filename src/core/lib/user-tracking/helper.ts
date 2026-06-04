import {
  APP_ENV,
  isAppStaging,
  isProduction,
  NETWORK_ENV,
} from "@/config/constants"
import type { TraceMeta } from "@/types/user-tracking"
import { safeObj } from "../data.helpers"

export const UserEventHelpers = {
  makeTrace(
    payload: Pick<TraceMeta, "trace_id"> & Record<string, unknown>,
  ): TraceMeta {
    return { ...safeObj(payload), __kind: "@hypbridge/tracing" as const }
  },

  add_metadata(event: Record<string, unknown>) {
    return {
      ...event,
      app_env: APP_ENV,
      network_env: NETWORK_ENV,
      group: isAppStaging
        ? "internal"
        : isProduction
          ? "production"
          : "development",
    }
  },
}
