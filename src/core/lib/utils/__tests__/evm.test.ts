import { Bsc, type EVMChainConfig } from "@hyperbridge-fe/shared"
import { createPublicClient } from "viem"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSdkEvmChain, evmTransport } from "../evm"

const FREE = "https://free.example"
const BACKUP = "https://backup.example"
const PROOF = "https://proof.example"

const network: EVMChainConfig = {
  ...Bsc,
  rpcUrls: [FREE, BACKUP],
  proofRpcUrl: PROOF,
}

const PROOF_RESULT = {
  address: Bsc.ismpHost,
  balance: "0x0",
  codeHash: `0x${"00".repeat(32)}`,
  nonce: "0x0",
  storageHash: `0x${"00".repeat(32)}`,
  accountProof: [],
  storageProof: [],
}

/**
 * Stubs fetch with a JSON-RPC server; returns the URL each method hit. URLs in
 * `failing` answer 503. `rpcErrors` sets how many times a URL first answers
 * with a JSON-RPC error, like a pruned node.
 */
function stubRpc(failing: string[] = [], rpcErrors: Record<string, number> = {}) {
  const errorsLeft = { ...rpcErrors }
  const calls: { url: string; method: string }[] = []

  // viem builds a Request before fetching, and Node's Request rejects jsdom's
  // AbortSignal. The stubbed fetch below never reads it.
  vi.stubGlobal(
    "Request",
    class {
      constructor(readonly url: string) {}
    },
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const { id, method } = JSON.parse(String(init.body))
      const url = new URL(input).origin
      calls.push({ url, method })

      if (failing.includes(url)) {
        return new Response("unavailable", { status: 503 })
      }

      if (errorsLeft[url]) {
        errorsLeft[url] -= 1
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: "historical state is not available" },
        })
      }

      const result =
        method === "eth_getProof"
          ? PROOF_RESULT
          : method === "eth_call"
            ? `0x${"00".repeat(32)}`
            : "0x1"

      return Response.json({ jsonrpc: "2.0", id, result })
    }),
  )

  return calls
}

function clientFor(config: EVMChainConfig) {
  return createPublicClient({
    transport: evmTransport(config),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("evmTransport", () => {
  it("sends eth_getProof to the proof RPC and everything else to the free RPCs", async () => {
    const calls = stubRpc()
    const client = clientFor(network)

    await client.getBlockNumber()
    await client.getProof({ address: Bsc.ismpHost, storageKeys: [] })

    expect(calls).toEqual([
      { url: FREE, method: "eth_blockNumber" },
      { url: PROOF, method: "eth_getProof" },
    ])
  })

  it("falls back to the free RPCs when the proof RPC fails", async () => {
    const calls = stubRpc([PROOF])
    const client = clientFor(network)

    await client.getProof({ address: Bsc.ismpHost, storageKeys: [] })

    expect(calls.at(-1)).toEqual({ url: FREE, method: "eth_getProof" })
  })

  it("retries the proof RPC when a node lacks the state", async () => {
    const calls = stubRpc([], { [PROOF]: 2 })
    const client = clientFor(network)

    await client.getProof({ address: Bsc.ismpHost, storageKeys: [] })

    expect(calls).toEqual(
      Array.from({ length: 3 }, () => ({ url: PROOF, method: "eth_getProof" })),
    )
  })

  it("falls back to the free RPCs after four failed proof attempts", async () => {
    const calls = stubRpc([], { [PROOF]: 10 })
    const client = clientFor(network)

    await client.getProof({ address: Bsc.ismpHost, storageKeys: [] })

    expect(calls.filter((c) => c.url === PROOF)).toHaveLength(4)
    expect(calls.at(-1)).toEqual({ url: FREE, method: "eth_getProof" })
  })

  it("falls back to the next free RPC for regular calls", async () => {
    const calls = stubRpc([FREE])
    const client = clientFor(network)

    await client.getBlockNumber()

    expect(calls.at(-1)).toEqual({ url: BACKUP, method: "eth_blockNumber" })
  })

  it("uses the free RPCs for proofs when no proof RPC is configured", async () => {
    const calls = stubRpc()
    const client = clientFor({ ...network, proofRpcUrl: undefined })

    await client.getProof({ address: Bsc.ismpHost, storageKeys: [] })

    expect(calls).toEqual([{ url: FREE, method: "eth_getProof" }])
  })
})

describe("createSdkEvmChain", () => {
  it("runs the SDK's own calls through evmTransport", async () => {
    const calls = stubRpc()
    const chain = createSdkEvmChain(network)

    await chain.currentEpoch()
    await chain.queryStateProof(1n, [`0x${"00".repeat(32)}`])

    expect(calls).toEqual([
      { url: FREE, method: "eth_call" },
      { url: PROOF, method: "eth_getProof" },
    ])
  })
})
