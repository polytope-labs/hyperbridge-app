import { WalletProviderType } from "@/constants"
import { isBraveWallet } from "@/helpers/metamask"
import { MetaMask } from "./MetaMask"

export class BraveWallet extends MetaMask {
  extensionName = WalletProviderType.BraveWallet
  title = "Brave Wallet"
  installUrl = "https://brave.com/wallet"
  logo = {
    src: "/wallets/brave.svg",
    alt: "Brave Wallet Logo",
  }

  get installed() {
    if (typeof window === "undefined") return false

    // @ts-ignoree
    const provider = this._provider || window?.ethereum

    return isBraveWallet(provider)
  }

  get rawExtension() {
    // @ts-ignore
    return this._provider || window?.ethereum
  }
}
