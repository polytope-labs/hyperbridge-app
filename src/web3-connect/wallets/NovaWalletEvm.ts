import { WalletProviderType } from "@/constants"
import { MetaMask } from "./MetaMask"

export class NovaWalletEvm extends MetaMask {
  extensionName = WalletProviderType.NovaWalletEvm
  title = "Nova Wallet (EVM)"
  logo = {
    src: "/wallets/nova.svg",
    alt: "Nova Wallet Logo",
  }

  get installed() {
    // Check if Nova Wallet is installed and has EVM support
    if (typeof window === "undefined") return false

    // @ts-expect-error Checking for Nova wallet global
    const isNovaWallet = window.walletExtension?.isNovaWallet

    // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
    const hasEthereum = !!(window as any).ethereum

    return !!(isNovaWallet && hasEthereum)
  }
}
