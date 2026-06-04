import type { EvmChainParams } from "@hyperbridge/sdk"
import type { EVMChainConfig } from "@hyperbridge-fe/shared"
import { getAddress } from "viem"

/**
 * Creates EvmChainParams for a given chain configuration.
 * This utility function extracts the required parameters from the network config.
 *
 * @param chainConfig - The network configuration for the chain
 * @returns EvmChainParams object with chainId, host (ISMP host), and url (RPC URL)
 */
export function createEvmChainParams(
  chainConfig: EVMChainConfig,
): EvmChainParams {
  return {
    chainId: chainConfig.chainId,
    host: chainConfig.ismpHost,
    rpcUrl: chainConfig.rpcUrls[0],
    bundlerUrl: chainConfig.intentGatewayV2?.bundlerUrl,
  }
}

export function bytes32ToEvmAddress(
  value: string,
  options?: { lowercase?: boolean; fallbackToInput?: boolean },
): string | null {
  try {
    const resolved =
      value.length === 66 && value.startsWith("0x")
        ? getAddress(`0x${value.slice(-40)}`)
        : getAddress(value)

    return options?.lowercase ? resolved.toLowerCase() : resolved
  } catch {
    return options?.fallbackToInput ? value : null
  }
}
