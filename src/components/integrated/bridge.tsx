import { FloatingActiveTransactions } from "@app/components/mediator-control"
import {
  SelectTokenModal,
  SelectTokenTrigger,
} from "@app/components/select-bridge-tokens"
import {
  NetworkDirectionSwitcher,
  NetworkModal,
} from "@app/components/select-network"
import { transferState } from "@app/stores/transfer"
import {
  adjustBalanceByPercentage,
  fetchFees,
  handleNetworkChange,
  handleTokenChange,
  refetchSourceBalance,
  setTransferAmount,
  verifyTransaction,
} from "@app/stores/transfer-actions"
import {
  bridgeTxState,
  estimatedTransferTime,
  inferSeverity,
  receivedAmount,
  receivedUSDAmount,
  safeBalance,
  safeRelayerFee,
  senderUsdValue,
} from "@app/stores/transfer-computed"
import { BridgeInput, Button, GradientButton, TagButton } from "@hyperbridge/ui"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { isAssetHub, matchChain, resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import { Portal } from "@radix-ui/react-portal"
import { flow, pipe } from "effect"
import { type Lambda, observe, runInAction } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { isHex } from "viem"
import { Loader } from "@/components/common/Loader"
import { ComputedTextValue } from "@/components/integrated/values"
import { LoadingButtonContent } from "@/components/loading-button"
import { SmartButton } from "@/components/smart-button"
import {
  TransferWarningContent,
  TransferWarningRoot,
  TransferWarningTrigger,
} from "@/components/transfer-warnings"
import { HyperBridgeConnectWallet } from "@/components/wallets/wallet-button"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { BalanceImpl } from "@/lib/factories/balance"
import { rootLogger } from "@/lib/logger"
import { encodePolkaAddress } from "@/lib/polkadot.helpers"
import { validateExistentialDeposit, validateRelayerFee } from "@/lib/transfer"
import { UserTracking } from "@/lib/user-tracking"
import { getNetworkConfig, safeNetworkConfig } from "@/lib/utils"
import { ms } from "@/lib/utils/date.helpers"
import { balancePreviewFormatter } from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import { toast } from "@/lib/utils/toast"
import { WalletManager, watchAccounts } from "@/lib/wallet-manager"
import type { ChainId } from "@/types"
import type { HexString } from "@/types/web3"
import { ConfirmTx } from "./bridge-review"
import { BridgeSummarySection } from "./bridge-summary"
import { FeeTokenFaucetLink } from "./fee-token-faucet"
import { SetRecipientDialog } from "./set-recipient-dialog"

const logger = rootLogger.withTag("BridgeTransfer")

function setupBridgeTransferEffects() {
  const disposers: Lambda[] = []

  const setSession = () => {
    UserTracking.set_session({
      evm: WalletManager.accounts.evm?.address,
      polkadot: WalletManager.accounts.substrate?.address,
    })
  }

  const setSenderAddress = () => {
    const account = WalletManager.getActiveAccountByChain(
      transferState.sourceChain,
    )
    if (account?.address === transferState.account) return
    runInAction(() => {
      transferState.account = (account?.address as HexString) || undefined
    })
  }

  SubstrateApiStore.hyperbridge
    .then(() => rootLogger.info("Hyperbridge API Initialized"))
    .catch(() => {})

  setSession()
  setSenderAddress()
  refetchSourceBalance({ mode: "foreground" })

  type PropertyKey = keyof typeof transferState
  const properties = new Set<PropertyKey>(["amount", "destChain"])

  disposers.push(refetchBalanceEvery(ms("15 seconds")))

  disposers.push(
    observe(transferState, (change) => {
      if (!properties.has(change.name as PropertyKey)) return

      if (change.type === "update") {
        try {
          if (!transferState.amount) return
          fetchFees()
        } catch (err) {
          toast.error("Error estimating relayer fee", {
            description: err.message,
          })
        }
      }
    }),
  )

  disposers.push(
    observe(transferState, async (change) => {
      if (change.name === "sourceChain") {
        const value = getNetworkConfig(transferState.sourceChain)
        if (value) {
          SubstrateApiStore.prepare(value, "websockets").catch((err) =>
            logger.trace(err),
          )
        }
      }

      if (change.name === "sourceChain" || change.name === "account") {
        setSenderAddress()
        runInAction(() => {
          setTransferAmount("")
          transferState.fee = "0"
        })
      }

      if (change.name === "destChain") {
        const network = getNetworkConfig(transferState.destChain)

        NetworkImpl.match(network, {
          _: () => {
            const polkaAddress = WalletManager.accounts.substrate?.address
            const encoded = encodePolkaAddress(polkaAddress)
            runInAction(() => {
              transferState.recipient = encoded
            })
          },
          evm: () => {
            runInAction(() => {
              transferState.recipient =
                WalletManager.accounts.evm?.address ?? ""
            })
          },
        })
      }
    }),
  )

  disposers.push(
    watchAccounts({
      onChange: ({ evm, substrate }) => {
        // automatically set recipient address
        setSenderAddress()
        refetchSourceBalance({ mode: "foreground" })
        setSession()

        matchChain(transferState.destChain, {
          none: () => {},
          evm: () => {
            runInAction(() => {
              transferState.recipient = evm?.address ?? ""
            })
          },
          _: () => {
            runInAction(() => {
              transferState.recipient = substrate?.address
                ? encodePolkaAddress(substrate.address)
                : ""
            })
          },
        })
      },
    }),
  )

  return () => {
    for (const f of disposers) {
      if (typeof f === "function") f()
    }
  }
}

export const BridgeTransfer = observer(function BridgeTransfer() {
  React.useEffect(() => setupBridgeTransferEffects(), [])

  const isLoading = false
  const isConnected = WalletManager.connectedAccounts.length > 0

  const [severity] = inferSeverity.get()
  const senderBalance = transferState.asyncBalance

  const effectiveReceiverAddress = transferState.recipient
  const estimatedTime = estimatedTransferTime

  function onSenderAmountChange(value: string) {
    runInAction(() => {
      setTransferAmount(value)
    })
  }

  function onPercentageReset() {}

  function onPercentageClick(percent_value: number | null) {
    if (percent_value === null) {
      return onPercentageReset?.()
    }

    runInAction(() => {
      const new_balance = adjustBalanceByPercentage(
        percent_value,
        safeBalance.get(),
      )

      setTransferAmount(new_balance)
    })
  }

  const senderToken = {
    image: transferState.token.logo,
    symbol: transferState.token.symbol,
  }

  return (
    <div className="flex flex-col gap-4">
      <NetworkDirectionSwitcher
        source={transferState.sourceChain}
        destination={transferState.destChain}
        onSwitch={({ source, destination }) => {
          handleNetworkChange({
            source: source,
            destination: destination,
          })
        }}
      />

      <div>
        <BridgeInput
          hasError={severity === "error"}
          mode={isConnected ? "ready" : "idle"}
          presentation={isLoading ? "loading" : "default"}
          sender={{
            token: senderToken,
            amount: transferState.amount,
            secondaryAmount: (
              <ComputedTextValue computedValue={senderUsdValue} />
            ),
            address: transferState.account || "",
            balance: senderBalance.case({
              pending: () => (
                <span>
                  <Loader />
                </span>
              ),
              fulfilled: () => {
                return (
                  <span>
                    {pipe(
                      transferState.syncBalance,
                      BalanceImpl.format,
                      Number,
                      balancePreviewFormatter.format,
                    )}{" "}
                    {transferState.syncBalance.symbol}
                  </span>
                )
              },
              rejected: () => <>0 {senderToken.symbol}</>,
            }),
          }}
          receiver={{
            network: pipe(
              safeNetworkConfig(transferState.destChain),
              O.map((e) => ({
                name: e.name,
                image: e.logo,
              })),
              O.getOrElse(() => ({
                name: "Default",
                image: resolvePublicUrl("/default-logo.png"),
              })),
            ),
            amount: receivedAmount.get(),
            estimatedTime: estimatedTime.get(),
            secondaryAmount: (
              <ComputedTextValue computedValue={receivedUSDAmount} />
            ),
            address: pipe(
              effectiveReceiverAddress,
              O.fromNullable,
              O.map((addr) => (isHex(addr) ? addr : encodePolkaAddress(addr))),
              O.getOrElse(() => "Enter address"),
            ),
          }}
          percentage={{
            value: transferState.percentage,
            options: [25, 75, 100],
          }}
          onValueChange={(v) => {
            onSenderAmountChange?.(v)
          }}
          onPercentageChange={onPercentageClick}
          EditDestAddressTrigger={(props) => {
            return <SetRecipientDialog>{props.children}</SetRecipientDialog>
          }}
          TokenChangeButton={
            <SelectTokenTrigger>
              <TagButton
                className="cursor-pointer"
                src={senderToken.image}
                symbol={senderToken.symbol}
                variant="trigger"
                disabled={isLoading}
              />
            </SelectTokenTrigger>
          }
        />
      </div>

      <FeeTokenFaucetLink />

      <BridgeSummarySection />

      <SubmitButton />

      {/*<MediatorControlDevComponent />*/}

      <FloatingActiveTransactions />

      <SelectTokenModal
        value={transferState.token}
        sourceChain={transferState.sourceChain}
        destChain={transferState.destChain}
        onChange={handleTokenChange}
      />

      <NetworkModal
        token={transferState.token}
        source={transferState.sourceChain}
        destination={transferState.destChain}
        filter={filterNetworkBySelectedToken}
        onNetworkChange={handleNetworkChange}
      />
    </div>
  )
})

const SubmitButton = observer(function SubmitButton() {
  const [severity, message, id] = inferSeverity.get()
  const submitButton = React.useRef<HTMLButtonElement>(null)

  const { isSourceAccountConnected, sourceNetwork } = bridgeTxState.get()

  if (!isSourceAccountConnected) {
    return (
      <HyperBridgeConnectWallet network={sourceNetwork}>
        <GradientButton>Connect Wallet</GradientButton>
      </HyperBridgeConnectWallet>
    )
  }

  if (id === "require-recipient-address") {
    return (
      <SetRecipientDialog>
        <Button variant={"secondary"} className="w-full">
          {message}
        </Button>
      </SetRecipientDialog>
    )
  }

  return (
    <TransferWarningRoot>
      {/* Show Confirmation Dialog */}
      <Portal>
        <ConfirmTx>
          <button
            ref={submitButton}
            type="button"
            className="hidden"
            disabled={O.isNone(transferState.bridgingTrigger)}
          >
            Confirmation
          </button>
        </ConfirmTx>
      </Portal>

      {/* Submit Button */}
      <TransferWarningTrigger
        validations={before_transfer_hooks}
        onSuccess={() => {
          verifyTransaction()
            .then(() => {
              submitButton.current?.click?.()
            })
            .catch((err) => {
              const message =
                err instanceof Error
                  ? err.message
                  : "Transaction verification failed"
              toast.error(message)
              console.error(err)
            })
        }}
      >
        <SmartButton
          severity={transferState.bridgeSetupPending ? "info" : severity}
          disabled={true}
          className="w-full"
        >
          <LoadingButtonContent
            loading={transferState.bridgeSetupPending}
            loadingText="Confirming"
          >
            {message}
          </LoadingButtonContent>
        </SmartButton>
      </TransferWarningTrigger>

      <TransferWarningContent />
    </TransferWarningRoot>
  )
})

const safeReadConfig = flow(getNetworkConfig, O.fromNullable, O.getOrThrow)

const before_transfer_hooks = [
  validateRelayerFee({
    params: () => ({
      relayerFee: pipe(
        safeRelayerFee.get(),
        O.map((e) => e.amount),
        O.getOrElse(() => 0),
      ),
      sourceChain: safeReadConfig(transferState.sourceChain),
      destChain: safeReadConfig(transferState.destChain),
      token: transferState.token,
    }),
  }),
  validateExistentialDeposit({
    params: () => {
      return {
        token: transferState.token,
        tokenRegistry: tokenRegistry,
        amount: transferState.amount,
        destChain: safeReadConfig(transferState.destChain),
      }
    },
  }),
]

function refetchBalanceEvery(duration: number = 15000) {
  const id = setInterval(
    () => refetchSourceBalance({ mode: "background" }),
    duration,
  )

  return () => clearInterval(id)
}

function filterNetworkBySelectedToken(
  selected: ChainId,
  // state: Pick<ShowOptions, "isSourceChain">,
) {
  const isAssetHubSelected = isAssetHub(selected)

  if (isAssetHubSelected) return false

  return true
}
