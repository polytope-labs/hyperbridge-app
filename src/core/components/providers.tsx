import { TooltipProvider } from "@hyperbridge/ui"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorDisplay } from "./error-state"

export function Providers(props: { children: React.JSX.Element }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorDisplay error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      <TooltipProvider>{props.children}</TooltipProvider>
    </ErrorBoundary>
  )
}
