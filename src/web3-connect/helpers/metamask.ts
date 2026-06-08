import type { EventEmitter } from "node:events"
import type { ExternalProvider } from "@ethersproject/providers"
import type { Maybe } from "@hyperbridge-fe/shared"
import { Sepolia } from "@hyperbridge-fe/shared/config"
import { safeObj } from "@hyperbridge-fe/shared/lib"
import { switchChain } from "@wagmi/core"
import type UniversalProvider from "@walletconnect/universal-provider"
import { sepolia } from "viem/chains"
import { walletManager } from "@/store/wallet-manager-registry"

const METAMASK_LIKE_CHECKS = [
  "isTalisman",
  "isSubWallet",
  "isPhantom",
  "isTrust",
  "isBraveWallet",
  "isEnkrypt",
] as const

type MetaMaskLikeChecksValues = (typeof METAMASK_LIKE_CHECKS)[number]

type MetaMaskLikeChecks = {
  [key in MetaMaskLikeChecksValues]: boolean
}

export interface MetaMaskLikeProvider
  extends ExternalProvider,
    EventEmitter,
    MetaMaskLikeChecks {}

export function isMetaMask(
  provider: Maybe<ExternalProvider>,
): provider is Required<MetaMaskLikeProvider> {
  return !!provider && !!provider?.isMetaMask
}

export function isMetaMaskLike(
  provider: Maybe<ExternalProvider>,
): provider is Required<MetaMaskLikeProvider> {
  return (
    !!provider &&
    typeof provider?.isMetaMask === "boolean" &&
    METAMASK_LIKE_CHECKS.some(
      (key) => !!(provider as MetaMaskLikeProvider)?.[key],
    )
  )
}

export function isTalisman(
  provider: Maybe<ExternalProvider>,
): provider is Required<MetaMaskLikeProvider> {
  return isMetaMaskLike(provider) && !!provider?.isTalisman
}

export function isSubWallet(provider: Maybe<ExternalProvider>) {
  return isMetaMaskLike(provider) && !!provider?.isSubWallet
}

export function isPhantom(provider: Maybe<ExternalProvider>) {
  return isMetaMaskLike(provider) && !!provider?.isPhantom
}

export function isTrustWallet(provider: Maybe<ExternalProvider>) {
  return isMetaMaskLike(provider) && !!provider?.isTrust
}

export function isBraveWallet(provider: Maybe<ExternalProvider>) {
  return isMetaMaskLike(provider) && !!provider?.isBraveWallet
}

export function isEnkrypt(provider: Maybe<ExternalProvider>) {
  return isMetaMaskLike(provider) && !!provider?.isEnkrypt
}

export function isEthereumProvider(
  provider: Maybe<ExternalProvider>,
): provider is Required<MetaMaskLikeProvider | UniversalProvider> {
  return typeof provider?.request === "function"
}

type RequestNetworkSwitchOptions = {
  onSwitch?: () => void
  chain?: string
}

// @TODO: Unify the switchChain logic. Use wagmi for this
export async function requestNetworkSwitch(
  provider: Maybe<MetaMaskLikeProvider>,
  options: RequestNetworkSwitchOptions = {},
) {
  console.assert(
    isEthereumProvider(provider),
    "`requestNetworkSwitch` only supports EVM Wallet Providers",
  )

  if (!isEthereumProvider(provider)) return

  try {
    const config = walletManager().wagmiConfig
    await switchChain(config, {
      chainId: Sepolia.chainId,
    }).then(options?.onSwitch)
  } catch (error) {
    const errorType = normalizeChainSwitchError(provider, error)

    if (errorType === "CHAIN_NOT_FOUND") {
      try {
        await provider
          .request({
            method: "wallet_addEthereumChain",
            params: [sepolia],
          })
          .then(options?.onSwitch)
      } catch {}
    } else {
      throw new Error(`Error switching network: ${error}`)
    }
  }
}

export type WatchAssetParams = {
  symbol: string
  decimals: number
  image?: string
}

function normalizeChainSwitchError(
  provider: Maybe<MetaMaskLikeProvider>,
  err: unknown,
) {
  const error = safeObj(err)
  if (!provider) return
  let message: Record<string, unknown> = {}
  try {
    message =
      typeof error?.message === "string" ? JSON.parse(error.message) : {}
  } catch {}

  const errorCode = // @ts-expect-error Ignoring
    message?.data?.originalError?.code ||
    // @ts-expect-error Ignoring
    error.data?.originalError?.code ||
    error?.code

  if (provider.isTrust) {
    const notFound = errorCode === 4200 || error?.message === "No assets found"
    if (notFound) return "CHAIN_NOT_FOUND"
  }

  if (errorCode === 4902) {
    return "CHAIN_NOT_FOUND"
  }
}
