import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { SubstrateApi } from "@/lib/substrate-api.ts"

export const SubstrateApiStore = new SubstrateApi(gatewayConfig)
