import { WalletProviderType } from "@/constants"
import { isEthereumProvider, isPhantom } from "@/helpers/metamask"
import { MetaMask } from "./MetaMask"

export class Phantom extends MetaMask {
  extensionName = WalletProviderType.Phantom
  title = "Phantom"
  installUrl = ""
  logo = {
    src: "/wallets/phantom.svg",
    alt: "Phantom Logo",
  }

  get installed() {
    if (typeof window === "undefined") return false
    // @ts-expect-error Expect phantom global to be present
    const provider = window?.phantom?.ethereum
    return isPhantom(provider) && isEthereumProvider(provider)
  }

  get rawExtension() {
    // @ts-expect-error Expect phantom global to be present
    return window?.phantom?.ethereum
  }
}
