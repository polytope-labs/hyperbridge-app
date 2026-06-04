import { BaseDotsamaWallet } from "@talismn/connect-wallets"
import { WalletProviderType } from "@/constants"

export class NovaWallet extends BaseDotsamaWallet {
  extensionName = WalletProviderType.NovaWallet
  title = "Nova Wallet"
  installUrl = "https://novawallet.io"
  logo = {
    src: "/wallets/nova.svg",
    alt: "Nova Wallet Logo",
  }

  get installed() {
    const injectedExtension = window?.injectedWeb3?.["polkadot-js"]
    // @ts-expect-error Expect phantom global to be present
    const isNovaWallet = window?.walletExtension?.isNovaWallet

    return !!(injectedExtension && isNovaWallet)
  }
}
