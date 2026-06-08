import { WalletProviderType } from "@/constants"
import { isTrustWallet } from "@/helpers/metamask"
import { MetaMask } from "./MetaMask"

// import Logo from "assets/icons/TrustWalletLogo.svg"

export class TrustWallet extends MetaMask {
  override extensionName = WalletProviderType.TrustWallet
  override title = "Trust Wallet"
  override installUrl = "https://trustwallet.com"
  override logo = {
    src: "/wallets/trust.svg",
    alt: "Trust Wallet Logo",
  }

  override get installed() {
    const provider = this._provider || window?.ethereum
    return isTrustWallet(provider)
  }

  override get rawExtension() {
    return this._provider || window?.ethereum
  }
}
