import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import { resolveNetworkGroup } from "@hyperbridge-fe/shared"
import { observable } from "mobx"
import { fromPromise } from "mobx-utils"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { BalanceImpl } from "@/lib/factories/balance"
import { FiatImpl } from "@/lib/factories/fiat"
import type { BridgeTxExecutor } from "@/lib/transactions/types"
import { O } from "@/lib/utils/fp.helpers"
import { getUnifiedAddressByGroup } from "@/lib/wallet-manager"
import type { AnyToken, AppBalance, ChainId } from "@/types"
import type { HexString } from "@/types/web3"

const sourceChain = gatewayConfig.defaultSourceChain.get()
const destChain = gatewayConfig.defaultDestChain.get()

const INITIAL_ADDRESS = ((): HexString => {
  const network_group = resolveNetworkGroup(sourceChain)
  const address = getUnifiedAddressByGroup(network_group)

  return (address || "") as HexString
})()

/** Placeholder when no tokens are registered (mainnet empty state) */
export const EMPTY_TOKEN = TokenImpl.evm({
  name: "No token",
  symbol: "",
  decimals: 18,
  logo: "/tokens/unknown.svg",
  disabled: true,
  address: "0x0000000000000000000000000000000000000000",
  recipientNetworks: [],
  existentialDeposit: 0,
})

export const INITIAL_TOKEN = ((): AnyToken => {
  const first = tokenRegistry.find_transferable_token({
    source: sourceChain,
    destination: destChain,
  })

  return (first.next().value as AnyToken | undefined) ?? EMPTY_TOKEN
})()

export const hasBridgeTokens = !tokenRegistry.isEmpty()

const syncBalance = BalanceImpl.empty()
export const DEFAULT_BALANCE = fromPromise(Promise.resolve(syncBalance))
export const DEFAULT_RELAYER_FEE = fromPromise(Promise.resolve(FiatImpl.empty))
export const DEFAULT_RELAYER_FEE_TOKEN = fromPromise(
  Promise.resolve(BalanceImpl.empty()),
)

export interface TransferState {
  sourceChain: ChainId
  destChain: ChainId
  syncBalance: AppBalance
  asyncBalance: typeof DEFAULT_BALANCE
  relayerFee: typeof DEFAULT_RELAYER_FEE
  /** HFT routes: relayer fee denominated in host fee token (USDH) */
  relayerFeeToken: typeof DEFAULT_RELAYER_FEE_TOKEN
  account: HexString
  showPolkadotWalletDialogue: boolean
  transactionPending: boolean
  token: AnyToken
  amount: string
  amountBigInt: bigint
  percentage: number | null
  recipient: string
  fee: string
  bridgeSetupPending: boolean
  // biome-ignore lint/suspicious/noExplicitAny: Sub Params type is not important
  bridgingTrigger: O.Option<BridgeTxExecutor<any>>
  nativeCost: bigint | null
}

export const transferState = observable<TransferState>({
  sourceChain: sourceChain,
  destChain: destChain,
  syncBalance: syncBalance,
  asyncBalance: DEFAULT_BALANCE,
  relayerFee: DEFAULT_RELAYER_FEE,
  relayerFeeToken: DEFAULT_RELAYER_FEE_TOKEN,
  account: INITIAL_ADDRESS,
  showPolkadotWalletDialogue: false,
  transactionPending: false,
  token: INITIAL_TOKEN,
  amount: "",
  amountBigInt: 0n,
  percentage: null,
  recipient: "",
  fee: "0",
  bridgeSetupPending: false,
  bridgingTrigger: O.none(),
  nativeCost: null,
})
