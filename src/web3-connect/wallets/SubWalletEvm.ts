import { WalletProviderType } from "@/constants"
import { isSubWallet } from "@/helpers/metamask"
import { MetaMask } from "./MetaMask"

export class SubWalletEvm extends MetaMask {
  extensionName = WalletProviderType.SubwalletEvm
  title = "SubWallet"
  installUrl =
    "https://chromewebstore.google.com/detail/subwallet-polkadot-wallet/onhogfjeacnfoofkfgppdlbmlmnplgbn"

  logo = {
    src: "/wallets/subwallet.svg",
    alt: "SubWallet Logo",
  }

  get installed() {
    return isSubWallet(
      // @ts-expect-error To be injected
      window.SubWallet as unknown,
    )
  }

  get rawExtension() {
    // @ts-expect-error
    return window.SubWallet
  }
}
