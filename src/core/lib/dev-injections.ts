import { isDevelopment } from "@/config/constants.ts"
import {
  assetManager,
  assetManagerStore,
} from "@/config/services/asset-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { BalanceImpl } from "@/lib/factories/balance.ts"
import { Polkadot } from "@hyperbridge-fe/shared"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"

if (isDevelopment) {
  // @ts-expect-error DevOnly
  window.__triggerTokenRefresh = () => {
    const token = tokenRegistry.getBySymbol(Polkadot.chainId, "DOT")

    if (!token) {
      return console.warn("[triggerTokenRefresh] Token not found")
    }

    return assetManager.refreshBalance({
      network: Polkadot,
      token: TokenImpl.substrate(token),
    })
  }

  // @ts-expect-error DevOnly
  window.__assetManager = assetManager
  // @ts-expect-error DevOnly
  window.__assetManagerStore = assetManagerStore

  // @ts-expect-error DevOnly
  window.__updateDot = (amount) => {
    assetManager.setBalance({
      network: Polkadot,
      // biome-ignore lint/style/noNonNullAssertion: DevOnly
      token: tokenRegistry.getBySymbol(Polkadot.chainId, "DOT")!,
      balance: BalanceImpl.parse(amount, 10, "DOT"),
    })
  }
}
