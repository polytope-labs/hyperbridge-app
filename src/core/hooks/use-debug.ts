import { useLocation } from "react-router"
import { isDevelopment } from "@/config/constants"

/**
 * Hook to check if debug mode is enabled.
 * Debug mode is enabled when:
 * - In development environment (always enabled), OR
 * - URL contains ?debug=true query parameter
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isDebug = useDebugMode()
 *
 *   if (!isDebug) return null
 *
 *   return <div>Debug information here</div>
 * }
 * ```
 */
export function useDebugMode(): boolean {
  const { search } = useLocation()
  const searchParams = new URLSearchParams(search)
  const hasDebugParam = searchParams.get("debug") === "true"

  return isDevelopment || hasDebugParam
}
