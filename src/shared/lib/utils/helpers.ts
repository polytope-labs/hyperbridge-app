import { isAddress } from "@polkadot/util-crypto"
import {
  Assethub,
  AssethubPaseo,
  Paseo,
  Polkadot,
} from "@/config/registry/relay-networks"
import { safeStr } from "@/lib/data.helpers"
import { O, pipe } from "@/lib/utils/fp.helpers"
import type {
  ChainId,
  NetworkTag,
  NetworkTagSimple,
  StateMachineId,
  WagmiChainId,
} from "../../types/network-types"
import type { Prettify, Values } from "@/types/utils"
import { isEvmAddress } from "./evm"

export function isNil<T>(val: T | null | undefined): val is null | undefined {
  return val === undefined || val === null
}

/**
 * Checks if the ChainId is Polkadot or Paseo network
 * @param chainId
 */
export function isRelayChain(chainId: ChainId): chainId is number {
  return chainId === Polkadot.chainId || chainId === Paseo.chainId
}

export function isSubstrate(chainId: ChainId): chainId is StateMachineId {
  return (
    String(chainId).startsWith("SUBSTRATE") ||
    String(chainId).startsWith("POLKADOT") ||
    String(chainId).startsWith("KUSAMA")
  )
}

export function isEVMChain(chainId: ChainId): chainId is WagmiChainId {
  return !(isRelayChain(chainId) || isAssetHub(chainId) || isSubstrate(chainId))
}

export function resolveNetworkGroup(chain: ChainId): NetworkTagSimple {
  if (isRelayChain(chain)) return "substrate"
  if (isAssetHub(chain)) return "substrate"
  if (isSubstrate(chain)) return "substrate"
  return "evm"
}

export function resolveNetworkTag(chain: ChainId): NetworkTag | null {
  if (isRelayChain(chain)) return "relay"
  if (isAssetHub(chain)) return "assetHub"
  if (isSubstrate(chain)) return "substrate"
  if (isEVMChain(chain)) return "evm"
  return null
}

type FnValues<
  // biome-ignore lint/suspicious/noExplicitAny: Represents a generic function
  T extends Record<string | number | symbol, (...a: any[]) => any>,
> = Prettify<{
  [key in keyof T]: ReturnType<T[key]>
}>

type Matchers = {
  evm?: (chainId: WagmiChainId) => unknown
  substrate?: (value: StateMachineId) => unknown
  relay?: (chainId: number) => unknown
  assetHub?: (chainId: number) => unknown
  _?: (chainId: WagmiChainId | StateMachineId) => unknown
}

/**
 * @todo Test this function
 */
export function matchChain<O extends ChainId, const TMatchers extends Matchers>(
  source: O,
  matchers: TMatchers & { none: () => unknown },
): Values<FnValues<TMatchers>> & {} {
  const network = resolveNetworkTag(source)
  // @ts-expect-error Fix later
  if (!network) return matchers.none()
  const match = matchers[network]

  // @ts-expect-error Fix later
  if (match) return match(source as unknown)

  // @ts-expect-error Fix later
  if (!matchers._) return matchers.none()

  // @ts-expect-error Fix later
  return matchers._(source)
}

const CHAIN_ID_NORMALIZE_MATCHER = Object.freeze({
  substrate: (v: StateMachineId) => O.some(v as ChainId),
  evm: (chain_id: WagmiChainId) => O.some(Number(chain_id) as ChainId),
  _: (chain_id: number) => O.some(Number(chain_id) as ChainId),
  none: () => O.none(),
} as const)

/** @todo function */
export function normalizeNetworkChainId(chain_id: ChainId): O.Option<ChainId> {
  // @ts-expect-error I know what I'm doing
  return matchChain(chain_id, CHAIN_ID_NORMALIZE_MATCHER)
}

/** @todo function */
export function chainEq(x: ChainId, y: ChainId) {
  return pipe(
    O.all([normalizeNetworkChainId(x), normalizeNetworkChainId(y)]),
    O.map(([a, b]) => a === b),
    O.getOrElse(() => false),
  )
}

export function isAssetHub(chainId: ChainId): chainId is number {
  return chainId === Assethub.chainId || chainId === AssethubPaseo.chainId
}

export const safeRpcURL = (type: "https" | "ws", url: string) => {
  const _url = trimProtocol(safeStr(url).trim())
  if (type === "ws") return `wss://${_url}`
  return `https://${_url}`

  function trimProtocol(url: string) {
    return safeStr(url).split("//")[1]
  }
}

export function isSubstrateAddress(address: unknown): boolean {
  const _address = safeStr(address)

  // @todo: isEvmAddress may not be needed here
  if (isEvmAddress(_address)) return false
  if (!isAddress(_address)) return false

  return true
}
