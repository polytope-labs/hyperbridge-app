import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@hyperbridge/ui"
import { Alert } from "@hyperbridge/ui/icons"
import { Slot } from "@radix-ui/react-slot"
import { Either, pipe } from "effect"
import React from "react"
import { rootLogger } from "@/lib/logger"
import { delay } from "@/lib/utils/async.helpers"

type WarningMessage<TKey = string> = Either.Either<
  { key: "okay" },
  {
    key: TKey
    heading: string
    message: string
  }
>

export type AppTransferValidationSchema = {
  validate: () => WarningMessage
}

export const TransferWarningTrigger = React.forwardRef<
  React.ComponentRef<"button">,
  React.ComponentProps<"button"> & {
    validations: AppTransferValidationSchema[]
    onSuccess: () => void
  }
>(function TransferWarningTrigger(props, ref) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const { stepThrough } = React.useContext(Ctx)

  return (
    <>
      <Slot
        ref={ref}
        onClick={async (evt) => {
          try {
            await stepThrough(props.validations, () => {
              triggerRef.current?.click?.()
              evt.preventDefault()
              evt.stopPropagation()
            })

            props.onSuccess()
          } catch {
            rootLogger.log("Step-through validation aborted")
          }
        }}
      >
        {props.children}
      </Slot>

      <DialogTrigger ref={triggerRef} aria-hidden={true} className={"hidden"}>
        Open Warning Dialog
      </DialogTrigger>
    </>
  )
})

export function TransferWarningContent() {
  const { status, resume, terminate } = React.useContext(Ctx)

  const cancel_button = (
    <DialogTrigger asChild>
      <Button
        variant={"secondary"}
        className="flex-1"
        onClick={() => terminate()}
      >
        Cancel
      </Button>
    </DialogTrigger>
  )

  const proceed_button = (
    <DialogTrigger asChild>
      <Button
        variant={"destructive"}
        className="flex-1"
        onClick={() => {
          delay(500).then(() => resume())
        }}
      >
        I understand
      </Button>
    </DialogTrigger>
  )

  return (
    <DialogContent
      className="glass-effect w-full max-w-md gap-8 text-[1rem]"
      onInteractOutside={(evt) => evt.preventDefault()}
    >
      <DialogDescription asChild className={"text-[1rem]"}>
        <div>
          {pipe(
            status,
            Either.match({
              onLeft: (status) => (
                <div className="flex flex-col gap-2.5">
                  <span className="bg-brand-danger-500/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                    <Alert
                      width={"1.25rem"}
                      height={"1.25rem"}
                      className={"text-brand-danger-500 shrink-0"}
                    />
                  </span>

                  <div className={"flex flex-col gap-2"}>
                    <DialogTitle
                      className={"text-h7 text-brand-white-500 font-medium"}
                    >
                      {status.heading}
                    </DialogTitle>
                    <p
                      className={"text-body-2 text-brand-black-100 font-medium"}
                    >
                      {status.message}
                    </p>
                  </div>
                </div>
              ),
              onRight: () => null,
            }),
          )}
        </div>
      </DialogDescription>

      {pipe(
        status,
        Either.match({
          onLeft: (status) => {
            if (status.key === "transfer-amount-too-small") {
              return <DialogFooter>{cancel_button}</DialogFooter>
            }

            return (
              <DialogFooter className={"gap-[1.2rem]"}>
                {cancel_button}
                {proceed_button}
              </DialogFooter>
            )
          },
          onRight: () => null,
        }),
      )}
    </DialogContent>
  )
}

export function TransferWarningRoot(props: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<WarningMessage>(() =>
    Either.right({ key: "okay" }),
  )

  const resume = React.useRef([
    (_: unknown): void => {},
    (_: unknown): void => {},
  ])

  async function stepThrough(
    validations: AppTransferValidationSchema[],
    onWarning?: () => void,
  ) {
    for (const validation of validations) {
      const safe_msg = validation.validate()

      if (Either.isLeft(safe_msg)) {
        setStatus(safe_msg)
        onWarning?.()

        await new Promise((res, rej) => {
          resume.current = [res, rej]
        })
      }
    }
  }

  React.useEffect(() => {
    return () => resume.current[1](undefined)
  }, [])

  return (
    <Ctx.Provider
      value={{
        status,
        stepThrough,
        resume: () => resume.current[0](undefined),
        terminate: () => resume.current[1](undefined),
      }}
    >
      <Dialog>{props.children}</Dialog>
    </Ctx.Provider>
  )
}

const Ctx = React.createContext<{
  status: WarningMessage
  resume: () => void
  terminate: () => void
  stepThrough: (
    validations: AppTransferValidationSchema[],
    onWarning?: () => void,
  ) => Promise<void>
}>({
  status: Either.right({ key: "okay" }),
  stepThrough: async () => {},
  resume: () => {},
  terminate: () => {},
})
