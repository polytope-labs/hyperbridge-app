import { refetchSourceBalance } from "@app/stores/transfer-actions"
import { transferState } from "@app/stores/transfer"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hyperbridge/ui"
import { NETWORK_ENV } from "@hyperbridge-fe/shared"
import { observer } from "mobx-react"
import React from "react"
import { toast } from "sonner"
import { formatUnits } from "viem"
import { isHftToken } from "@/lib/hft/hyper-fungible-token"
import {
  readFeeTokenBalance,
  requestFeeTokenDrip,
} from "@/lib/fee-token-preparation"
import { getNetworkConfig } from "@/lib/utils"
import type { EVMChainConfig } from "@/types"

export const FeeTokenFaucetLink = observer(function FeeTokenFaucetLink() {
  const token = transferState.token
  const account = transferState.account

  const show =
    NETWORK_ENV !== "mainnet" &&
    token.__type === "evm" &&
    isHftToken(token) &&
    account != null

  if (!show) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="-mt-2 cursor-pointer text-caption text-brand-black-100/60 hover:text-brand-black-100 w-fit underline-offset-2 transition-colors hover:underline"
        >
          Need USDH for bridge fees?
        </button>
      </DialogTrigger>

      <FeeTokenFaucetDialogContent />
    </Dialog>
  )
})

function FeeTokenFaucetDialogContent() {
  const [loading, setLoading] = React.useState(false)
  const [balanceLabel, setBalanceLabel] = React.useState<string | null>(null)

  const account = transferState.account
  const sourceChain = transferState.sourceChain
  const source = getNetworkConfig(sourceChain) as EVMChainConfig

  React.useEffect(() => {
    if (!account) return

    readFeeTokenBalance({ owner: account, source })
      .then((feeToken) => {
        setBalanceLabel(
          `${formatUnits(feeToken.balance, feeToken.decimals)} ${feeToken.symbol}`,
        )
      })
      .catch(() => setBalanceLabel(null))
  }, [account, source])

  async function handleDrip() {
    if (!account) return

    setLoading(true)
    try {
      const feeToken = await readFeeTokenBalance({
        owner: account,
        source,
      })

      await requestFeeTokenDrip({
        owner: account,
        source,
        feeTokenAddress: feeToken.address,
      })

      const updated = await readFeeTokenBalance({
        owner: account,
        source,
      })

      setBalanceLabel(
        `${formatUnits(updated.balance, updated.decimals)} ${updated.symbol}`,
      )

      toast.success(
        `Received testnet ${updated.symbol}. Balance: ${formatUnits(updated.balance, updated.decimals)}`,
      )

      refetchSourceBalance({ mode: "foreground" })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not drip fee tokens. You may have already claimed today."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="gap-0">
      <DialogHeader>
        <DialogTitle>Get testnet fee tokens</DialogTitle>
        <DialogDescription className="text-body-2 text-brand-black-100 pt-2">
          Testnet fee tokens will be sent to your connected wallet.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="gap-3 sm:gap-3">
        <Button
          type="button"
          className="flex-1"
          disabled={loading}
          onClick={handleDrip}
        >
          {loading ? "Requesting…" : "Get testnet USDH"}
        </Button>
      </DialogFooter>

      {Boolean(balanceLabel) && <p className="text-brand-black-100/40 text-caption mt-4">
       Your balance: <span className="font-medium text-white">{balanceLabel}</span>
      </p>}
    </DialogContent>
  )
}
