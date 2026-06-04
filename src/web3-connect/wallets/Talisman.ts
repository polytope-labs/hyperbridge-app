import {
  NotInstalledError,
  TalismanWallet,
  type WalletAccount,
} from "@talismn/connect-wallets"
import { WalletProviderType } from "@/constants"
import { WalletManagerGlobal } from "@/store/wallet-manager-registry"
import { WalletMode } from "@/types"

export class Talisman extends TalismanWallet {
  extensionName = WalletProviderType.Talisman

  logo = {
    src: "/wallets/talisman.svg",
    alt: "Talisman Logo",
  }

  getAccounts = async (anyType?: boolean): Promise<WalletAccount[]> => {
    if (!this._extension) {
      throw new NotInstalledError(
        `The 'Wallet.enable(dappname)' function should be called first.`,
        this,
      )
    }

    const walletMode = WalletManagerGlobal.mode
    const accounts = await this._extension.accounts.get(anyType)
    const accountsWithWallet = accounts
      .filter(({ type }) =>
        walletMode === WalletMode.SubstrateH160
          ? type === "ethereum"
          : type === "sr25519",
      )
      .map((account) => {
        return {
          ...account,
          source: this._extension?.name as string,
          wallet: this,
          signer: this._extension?.signer,
        }
      })

    return accountsWithWallet
  }
}
