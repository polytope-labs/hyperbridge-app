import type { ReactNode } from "react"

interface IfProps {
  cond: boolean
  children: ReactNode
}

/**
 * Conditional rendering component
 */
function If({ cond: condition, children }: IfProps) {
  if (!condition) return null

  return <>{children}</>
}

export default If
