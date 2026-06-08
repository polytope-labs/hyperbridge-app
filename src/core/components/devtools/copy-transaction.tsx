import { Button } from "@hyperbridge/ui"
import { Copy } from "@hyperbridge/ui/icons"
import { JSONStringify } from "json-with-bigint"
import { PlayIcon, RefreshCcw, StopCircleIcon } from "lucide-react"
import React from "react"
import { useDebugMode } from "@/hooks/use-debug"
import { TxImpl } from "@/lib/factories/transaction"
import { O, pipe } from "@/lib/utils/fp.helpers"
import { toast } from "@/lib/utils/toast"
import type { Transaction } from "@/types/tx"
import { useTxTimeline } from "../transaction/integrated/context"

const INITIAL_BLOCK_NUMBER = BigInt(0)

export function CopyTransactionButton({
  transaction: tx,
  children,
}: {
  transaction: Transaction
  children?: React.ReactNode
}) {
  const { controller } = useTxTimeline()
  const isDebug = useDebugMode()
  const transactionRef = React.useRef(tx)

  React.useEffect(() => {
    transactionRef.current = tx
  }, [tx])

  if (!isDebug) return null

  return (
    <div className="flex flex-wrap justify-center gap-x-2">
      <Button
        size="xs"
        variant="unstyled"
        onClick={() => {
          const transaction = transactionRef.current
          // @ts-expect-error For development purposes only
          window.__tx = transaction
          const txJson = JSONStringify(transaction)
          navigator.clipboard.writeText(txJson).then(() => {
            toast.success("Copied")
          })
        }}
      >
        <Copy />
        Copy Tx Payload
      </Button>

      <Button
        size="xs"
        variant="unstyled"
        onClick={() => {
          const transaction = transactionRef.current
          const commitment = pipe(
            TxImpl.commitment(transaction),
            O.getOrElse(() => "none"),
          )

          navigator.clipboard.writeText(commitment).then(() => {
            toast.success("Copied")
          })
        }}
      >
        <Copy />
        Copy Commitment Hash
      </Button>

      <Button
        size="xs"
        variant="unstyled"
        onClick={() => {
          const transaction = transactionRef.current
          if (
            TxImpl.is_completed(transaction, TxImpl.infer_mode(transaction))
          ) {
            return toast.error("Can't reset completed Transaction")
          }

          if (TxImpl.is_timed_out(transaction)) {
            transaction.timeoutProgress = {}
          } else {
            transaction.progress = {
              Dispatched: {
                status: {
                  kind: "Dispatched",
                  block_number: INITIAL_BLOCK_NUMBER,
                },
                timestamp: Date.now(),
                write_tag: "forced",
              },
            }
          }
        }}
      >
        <RefreshCcw />
        Reset
      </Button>

      <Button
        size="xs"
        variant="unstyled"
        onClick={() => {
          controller.start()
        }}
      >
        <PlayIcon />
        Play
      </Button>

      <Button
        size="xs"
        variant="unstyled"
        onClick={() => {
          controller.stop()
        }}
      >
        <StopCircleIcon />
        Stop
      </Button>
      {children}
    </div>
  )
}
