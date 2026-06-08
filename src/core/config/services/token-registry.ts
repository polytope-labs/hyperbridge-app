import { NETWORK_ENV, TokenRegistry } from "@hyperbridge-fe/shared"
import {
  MainAssetRegistry,
  TestAssetRegistry,
} from "@/config/registry/tokens.ts"

const ASSET_REGISTRY = {
  mainnet: MainAssetRegistry,
  testnet: TestAssetRegistry,
} as const

export const tokenRegistry = new TokenRegistry(ASSET_REGISTRY[NETWORK_ENV])
