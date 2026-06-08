import { WalletProviderType } from "@/constants"
import { isTalisman } from "@/helpers/metamask"
import { MetaMask } from "./MetaMask"

export class TalismanEvm extends MetaMask {
  extensionName = WalletProviderType.TalismanEvm
  title = "Talisman"
  installUrl = "https://www.talisman.xyz/download"
  logo = {
    src: "/wallets/talisman.svg",
    alt: "Talisman Logo",
  }

  get installed() {
    // @ts-expect-error
    return isTalisman(window.talismanEth)
  }

  get rawExtension() {
    // @ts-expect-error
    return window.talismanEth
  }
}
