import { MAINNET_HFT_TOKENS } from "./mainnet"
import { TESTNET_HFT_TOKENS } from "./testnet"
import { buildHftRegistry } from "./build-registry"

export type { HftTokenDefinition, HftDeployment, HftTokenType, HftTokenMeta } from "./types"
export { MAINNET_HFT_TOKENS, TESTNET_HFT_TOKENS }
export { buildHftRegistry, getHftChainIds } from "./build-registry"

export const MainAssetRegistry = buildHftRegistry(MAINNET_HFT_TOKENS)
export const TestAssetRegistry = buildHftRegistry(TESTNET_HFT_TOKENS)
