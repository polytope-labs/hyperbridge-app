import type { ExternalProvider } from "@ethersproject/providers"
import type {
  Wallet,
  WalletAccount,
  WalletLogoProps,
} from "@talismn/connect-wallets"
import { ethers } from "ethers"

type WalletSigner = ethers.providers.JsonRpcSigner | null | undefined
type ExtensionType = ExternalProvider | unknown

export abstract class WagmiControlledWallet implements Wallet {
  installed = false

  extensionName = "GenericWallet"
  title = "GenericWallet"
  installUrl = ""

  logo: WalletLogoProps = {
    src: "",
    alt: "",
  }

  getAccounts = async () => [] as WalletAccount[]

  subscribeAccounts = () => {}

  sign = () => {}

  transformError = (err: Error) => err

  enable = async (dappName: string): Promise<void> => {
    throw new Error(`Not implemented: ${dappName}`)
  }

  noExtensionMessage?: string | undefined

  extension: ExtensionType = null

  _signerImpl: WalletSigner = undefined

  get signer(): { signer: ethers.providers.JsonRpcSigner } | undefined {
    if (
      this._signerImpl &&
      this._signerImpl instanceof ethers.providers.JsonRpcSigner
    ) {
      return { signer: this._signerImpl }
    }
    return undefined
  }
}
