import { Button } from "@hyperbridge/ui"
import { getErrorMessage } from "@/lib/error.helpers"

type Props = {
  error: unknown
  resetErrorBoundary: (...args: unknown[]) => void
}

export function ErrorDisplay({ error, resetErrorBoundary }: Props) {
  return (
    <section className={""}>
      <h1 className={"text-2xl"}>Error, sorry</h1>

      <div>
        <div className={"text-base"}>
          {getErrorMessage(error) || "An error occurred"}
        </div>

        <Button type="button" onClick={resetErrorBoundary}>
          Retry App
        </Button>
      </div>
    </section>
  )
}
