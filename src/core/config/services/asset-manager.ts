import { NETWORK_ENV } from "@/config/constants.ts"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { priceManager } from "@/config/services/price-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { AssetsManager } from "@/lib/assets-manager.ts"
import { AssetManagerStore } from "@/lib/assets-store.ts"
import { BalanceHelper } from "@/lib/balance-helper.ts"
import { O } from "@/lib/utils/fp.helpers"
import { WalletManager } from "@/lib/wallet-manager.ts"

export const assetManagerStore = new AssetManagerStore()
export const assetManager = new AssetsManager(assetManagerStore, {
  priceManager: priceManager,
  balanceHelper: BalanceHelper,
  *resolveNetworkAndTokens() {
    const tokens = tokenRegistry.allTokens()

    for (const [chainId, token] of tokens) {
      const network = gatewayConfig.getNetwork(chainId)
      if (!network) continue
      if (network.networkType !== NETWORK_ENV) continue

      yield {
        token,
        network,
      }
    }
  },
  getAccount(network) {
    return O.fromNullable(
      WalletManager.getActiveAccountByChain(network.chainId),
    )
  },
})
