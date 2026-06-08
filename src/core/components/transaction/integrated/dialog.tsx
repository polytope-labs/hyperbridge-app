import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hyperbridge/ui"
import { Slot } from "@radix-ui/react-slot"
import { MinusIcon } from "lucide-react"
import React from "react"
import { txPopup } from "@/stores/tx-preview"
import type { Transaction } from "@/types/tx"
import { TTContent } from "./content"
import { TTProvider } from "./provider"

type Props = React.ComponentProps<typeof Dialog> & {
  children?: React.ReactNode
  tx: Transaction
}

export function TransactionDialog(props: Props) {
  const { tx, ...PROPS } = props

  return (
    <Dialog {...PROPS}>
      {React.Children.count(props.children) === 0 ? null : (
        <DialogTrigger asChild>{props.children}</DialogTrigger>
      )}

      <DialogContent className="gap-0" showCloseButton={false}>
        <DialogTitle>
          <span className="sr-only">Bridging Transaction</span>
        </DialogTitle>

        <DialogTrigger asChild>
          <MinimizeButton />
        </DialogTrigger>

        <TTProvider tx={tx}>
          <DialogHeader>
            <DialogTitle>
              <span className="sr-only">Bridging Transaction</span>
            </DialogTitle>
          </DialogHeader>

          <TTContent />
        </TTProvider>
      </DialogContent>
    </Dialog>
  )
}

function MinimizeButton(props: React.ComponentProps<"button">) {
  return (
    <Button
      {...props}
      size="icon"
      variant="level_1"
      className="hover:bg-brand-black-500 bg-brand-black-350 group absolute end-4 top-4 gap-0 rounded-full p-2"
    >
      <MinusIcon />
      <span className="inline-block w-0 overflow-hidden text-xs tracking-wider transition-[width] group-hover:w-[8ch] group-focus:w-[8ch]">
        Minimize
      </span>
    </Button>
  )
}

export function TransactionDialogTrigger(
  props: React.ComponentProps<"button"> & {
    tx_hash: Transaction["transaction_hash"]
  },
) {
  return (
    <Slot onClick={() => txPopup.switch(props.tx_hash)}>{props.children}</Slot>
  )
}
