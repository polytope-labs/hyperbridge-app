import type { ExternalProvider } from "@ethersproject/providers"
import { safeStr, shortenAccountAddress } from "@hyperbridge-fe/shared/lib"
import type { HexString } from "@polkadot/util/types"
import type { WalletAccount } from "@talismn/connect-wallets"
import {
  type GetAccountReturnType,
  getAccount,
  watchAccount,
} from "@wagmi/core"
import consola from "consola"
import { ethers } from "ethers"
import { getAddress } from "viem"
import { WalletProviderType } from "@/constants"
import { WagmiControlledWallet } from "@/store/wagmi-controlled"
import { walletManager } from "@/store/wallet-manager-registry"

export class Coinbase extends WagmiControlledWallet {
  title = "Coinbase"
  extensionName: WalletProviderType = WalletProviderType.Coinbase
  installUrl = "https://www.coinbase.com/wallet/downloads"
  logo = {
    src: "/wallets/coinbase.svg",
    alt: "Coinbase Logo",
  }

  installed = true
  _signerImpl: ethers.providers.JsonRpcSigner | undefined = undefined

  enable = async (dappName: string): Promise<void> => {
    if (!dappName) {
      throw new Error("MissingParamsError: Dapp name is required.")
    }

    try {
      const account = getAccount(this.config)
      if (!account || account?.connector?.id !== "coinbaseWalletSDK") {
        return
      }

      await this.initializeSigner(account)
    } catch (err) {
      consola.error("Failed to enable Coinbase wallet:", err)
      throw this.transformError(err as Error)
    }
  }

  async initializeSigner(account: GetAccountReturnType): Promise<void> {
    if (!account?.connector) return

    try {
      const provider = await account.connector.getProvider()
      const ethersProvider = new ethers.providers.Web3Provider(
        provider as ExternalProvider,
      )
      this._signerImpl = ethersProvider.getSigner()
    } catch (error) {
      consola.error("Failed to create Coinbase signer:", error)
    }
  }

  private get config() {
    return walletManager().wagmiConfig
  }

  getAccounts = async (): Promise<WalletAccount[]> => {
    const account = getAccount(this.config)

    if (!account) return []
    if (account?.connector?.id !== "coinbaseWalletSDK") return []

    const formattedAddress = getAddress(safeStr(account.address).toLowerCase())

    if (!this._signerImpl) {
      try {
        const provider = await account.connector.getProvider()
        const ethersProvider = new ethers.providers.Web3Provider(
          provider as ExternalProvider,
        )
        this._signerImpl = ethersProvider.getSigner()
      } catch (error) {
        consola.error("Failed to create Coinbase signer:", error)
      }
    }

    return [
      {
        address: account.address as HexString,
        source: WalletProviderType.Coinbase,
        name: shortenAccountAddress(formattedAddress),
        wallet: this,
        signer: { signer: this._signerImpl },
      },
    ]
  }

  subscribeAccounts = async (
    callback?: (accounts: WalletAccount[]) => void | Promise<void>,
  ) => {
    const unwatch = watchAccount(this.config, {
      onChange: async (account) => {
        if (account?.connector?.id === "coinbaseWalletSDK") {
          await this.initializeSigner(account)
        }

        if (callback) {
          const accounts = await this.getAccounts()
          callback(accounts)
        }
      },
    })

    return unwatch
  }
}
