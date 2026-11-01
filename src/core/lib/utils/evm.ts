import { EvmChain, getViemChain } from "@hyperbridge/sdk"
import type { EVMChainConfig } from "@hyperbridge-fe/shared"
import {
  createPublicClient,
  createTransport,
  fallback,
  getAddress,
  http,
  type Chain,
  type Transport,
} from "viem"

/**
 * dRPC balances proofs across archive and pruned nodes, so a proof that fails
 * often succeeds on the next try. viem doesn't retry "historical state" errors.
 */
const PROOF_ATTEMPTS = 4

/**
 * The transport for every EVM read in the app, both wagmi's and the SDK's.
 * Regular calls fall back through the chain's free RPCs. eth_getProof goes to
 * the proof RPC first, since free nodes only keep proofs for recent blocks,
 * and falls back to the free RPCs, which still serve recent heights.
 */
export function evmTransport(network: EVMChainConfig): Transport {
  const free = network.rpcUrls.map((url) => http(url))
  const regular = free.length > 1 ? fallback(free) : free[0]

  const proofUrl = network.proofRpcUrl
  if (!proofUrl) return regular

  const proofs = fallback([
    ...Array.from({ length: PROOF_ATTEMPTS }, () =>
      http(proofUrl, { retryCount: 0 }),
    ),
    regular,
  ])

  return (config) => {
    const regularTransport = regular(config)
    const proofTransport = proofs(config)
    const route = (method: string) =>
      method === "eth_getProof" ? proofTransport : regularTransport

    return createTransport({
      key: "proofRouted",
      name: "Proof-routed",
      type: "proofRouted",
      // The inner transports already retry.
      retryCount: 0,
      // The inner and outer request generics are unrelated to the compiler.
      request: (args, options) =>
        route(args.method).request(args, options) as never,
    })
  }
}

/**
 * Builds an SDK EvmChain that uses evmTransport. The SDK builds its own client
 * on a single URL and has no option to pass one in, so ours is swapped in.
 */
export function createSdkEvmChain(network: EVMChainConfig): EvmChain {
  const chain = EvmChain.fromParams({
    chainId: network.chainId,
    host: network.ismpHost,
    rpcUrl: network.rpcUrls[0],
    consensusStateId: network.consensus.stateId,
  })

  const client = createPublicClient({
    // The SDK's Chain type comes from its own viem copy.
    chain: getViemChain(network.chainId) as Chain | undefined,
    transport: evmTransport(network),
  })

  Object.assign(chain, { publicClient: client })

  // Fail loudly if an SDK upgrade renames the field, instead of silently
  // dropping fallback and proof routing.
  if (chain.client !== client) {
    throw new Error(
      "EvmChain.publicClient not found; update createSdkEvmChain for this SDK version",
    )
  }

  return chain
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
