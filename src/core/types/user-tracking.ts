import type { Prettify } from "@/lib/utils/types"

export type TraceMeta = Prettify<{
  __kind: "@hypbridge/tracing"
  trace_id: string
}>
