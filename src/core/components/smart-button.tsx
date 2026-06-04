import { Button } from "@hyperbridge/ui"
import { safeObj } from "@hyperbridge-fe/shared"
import type React from "react"

export type SeverityState = "error" | "warn" | "success" | "default" | "info"

type ButtonProps = React.ComponentProps<typeof Button>

interface SmartButtonProps extends ButtonProps {
  severity: SeverityState
  loading?: boolean
}

export const SmartButton = function SmartButton(props: SmartButtonProps) {
  const { children, className, ref, severity, ...buttonProps } = props
  const variantProps = severity ? variantMap[severity] : variantMap.default

  return (
    <Button
      ref={ref}
      {...buttonProps}
      {...safeObj(variantProps)}
      className={className}
    >
      {children}
    </Button>
  )
}

const variantMap = {
  default: { variant: "default", disabled: false },
  success: { variant: "default", disabled: false },
  error: { variant: "destructive", disabled: true },
  warn: { variant: "destructive", disabled: true },
  info: { variant: "secondary", disabled: true },
} as const
