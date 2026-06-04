import { tokenImages } from "@hyperbridge-fe/shared/config"
import { isNil } from "lodash-es"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import type { ChainId, Maybe } from "@/types"

interface ITokenImageRegistry {
  getByChain(network?: ChainId): string
  getBySymbol(symbol?: string): string
}

const DEFAULT_IMAGE_URL = "/networks/hyperbridge.png"
const DEFAULT_CHAIN_IMAGE_URL = "/logo.svg"

export const TokenImageRegistry: ITokenImageRegistry = {
  getByChain(chainId: Maybe<ChainId>): string {
    if (isNil(chainId)) return DEFAULT_CHAIN_IMAGE_URL

    return gatewayConfig.getNetwork(chainId)?.logo ?? DEFAULT_CHAIN_IMAGE_URL
  },

  getBySymbol(token_symbol: string): string {
    return (
      (tokenImages as Record<string, string>)[token_symbol] ?? DEFAULT_IMAGE_URL
    )
  },
}
