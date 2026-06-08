import { shortenAccountAddress } from "@hyperbridge-fe/shared/lib"
import type {
  SubscriptionFn,
  Wallet,
  WalletAccount,
} from "@talismn/connect-wallets"
import consola from "consola"
import { getAddress } from "viem"
import { WalletProviderType } from "@/constants"
import {
  isMetaMask,
  isMetaMaskLike,
  type MetaMaskLikeProvider,
} from "@/helpers/metamask"
import { EthereumSigner } from "@/signer/EthereumSigner"
import type { EIP1193Provider } from "@/types"

type ChainSubscriptionFn = (payload: number | null) => void | Promise<void>

type MetamaskInit = {
  provider?: EIP1193Provider
  onAccountsChanged?: SubscriptionFn
  onChainChanged?: ChainSubscriptionFn
}

export class MetaMask implements Wallet {
  title = "MetaMask"
  extensionName: WalletProviderType = WalletProviderType.MetaMask
  installUrl = "https://metamask.io/download"

  logo = {
    src: "/wallets/metamask.svg",
    alt: "MetaMask Logo",
  }

  _extension: Required<MetaMaskLikeProvider> | undefined
  _signer: EthereumSigner | undefined
  _provider: EIP1193Provider | undefined

  onAccountsChanged: SubscriptionFn | undefined
  onChainChanged: ChainSubscriptionFn | undefined

  constructor(
    { provider, onAccountsChanged, onChainChanged }: MetamaskInit = {
      onAccountsChanged: () => {},
      onChainChanged: () => {},
    },
  ) {
    this.onAccountsChanged = onAccountsChanged
    this.onChainChanged = onChainChanged
    this._provider = provider
  }

  get extension() {
    return this._extension
  }

  get signer() {
    return this._signer
  }

  get installed() {
    const provider = this._provider || window?.ethereum
    return isMetaMask(provider)
  }

  get rawExtension() {
    return this._provider || window?.ethereum
  }

  transformError = (err: Error): Error => {
    return new Error(err.message)
  }

  enable = async (dappName: string) => {
    if (!dappName) {
      throw new Error("MissingParamsError: Dapp name is required.")
    }

    const provider = this.rawExtension

    if (!provider || (!isMetaMask(provider) && !isMetaMaskLike(provider))) {
      consola.error("MetaMask provider not found or not MetaMask-like.")
      throw new Error("MetaMask provider not available.")
    }

    this._extension = provider as Required<MetaMaskLikeProvider>

    try {
      const accounts = (await this._extension.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[]

      const mainAddress = accounts?.[0]
        ? getAddress(accounts[0].toLowerCase())
        : undefined

      if (mainAddress) {
        try {
          const signerInstance = new EthereumSigner(
            mainAddress,
            this._extension,
          )
          this._signer = signerInstance
        } catch (_signerError) {
          this._signer = undefined
        }
      } else {
        this._signer = undefined
      }

      this.subscribeAccounts(this.onAccountsChanged)
      this.subscribeChain(this.onChainChanged)
    } catch (err) {
      // don't treat pending requests as errors
      if ((err as { code?: number })?.code === -32002) {
        return
      }
      throw this.transformError(err as Error)
    }
  }

  getAccounts = async (): Promise<WalletAccount[]> => {
    if (!this._extension) {
      throw new Error(
        `The 'Wallet.enable(dappname)' function should be called first.`,
      )
    }

    const accounts = (await this._extension.request({
      method: "eth_accounts", // Better to use when app is already authorized it avoids duplicate popups when users is already connected
      params: [],
    })) as string[]

    return (accounts || []).slice(0, 1).map(this.toWalletAccount)
  }

  toWalletAccount = (address: string): WalletAccount => {
    const formattedAddress = getAddress(address.toLowerCase())

    return {
      address: formattedAddress,
      source: this.extensionName,
      name: shortenAccountAddress(formattedAddress),
      wallet: this,
      signer: this._signer ?? undefined,
    }
  }

  subscribeAccounts = async (callback?: SubscriptionFn) => {
    if (!this._extension) return

    this._extension.on("accountsChanged", (payload) => {
      const addresses = Array.isArray(payload) ? payload : []
      const accounts = addresses.slice(0, 1).map(this.toWalletAccount)
      callback?.(accounts)

      const mainAccount = accounts[0]
      if (this._signer) {
        this._signer.setAddress(mainAccount?.address)
        // For debugging purposes
        consola.debug(
          "MetaMask signer address updated to:",
          mainAccount?.address,
        )
      } else if (mainAccount?.address) {
        // For debugging purposes
        consola.warn(
          "MetaMask accountsChanged: Signer doesn't exist to update address.",
        )
      }
    })
  }

  subscribeChain = async (callback?: ChainSubscriptionFn) => {
    if (!this._extension) {
      throw new Error(
        `The 'Wallet.enable(dappname)' function should be called first.`,
      )
    }

    this._extension.on("chainChanged", async (payload) => {
      const chainId =
        typeof payload === "string" ? Number.parseInt(payload) : null
      callback?.(chainId)
    })
  }

  unsubscribe = () => {
    this._extension?.removeAllListeners?.()
    this._extension = undefined
    this._signer = undefined
  }
}
