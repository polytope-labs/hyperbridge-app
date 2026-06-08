import type { Wallet } from "@talismn/connect-wallets"
import { WalletProviderType } from "@/constants"
import { WalletConnect } from "@/wallets/WalletConnect"

export class WalletConnectEvm extends WalletConnect implements Wallet {
  extensionName = WalletProviderType.WalletConnectEvm
  title = "WalletConnect"
  installUrl = ""
  logo = {
    src: "/wallets/wallet-connect.svg",
    alt: "WalletConnect Logo",
  }
}
