import { Bsc, Nexus, Polygon } from "@hyperbridge-fe/shared/config"
import { u8aToHex } from "@polkadot/util"
import { decodeAddress } from "@polkadot/util-crypto"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base"
import { HftBridgeTx } from "../bridge-hft"

const mocks = vi.hoisted(() => ({
  bridge: vi.fn(),
  ensureFeeTokenBalance: vi.fn().mockResolvedValue(undefined),
  getHyperFungibleToken: vi.fn(),
}))

vi.mock("@wagmi/core", () => ({
  getAccount: vi.fn(() => ({
    address: "0x1111111111111111111111111111111111111111",
  })),
  sendTransaction: vi.fn(),
  switchChain: vi.fn().mockResolvedValue(undefined),
  waitForTransactionReceipt: vi.fn(),
}))

vi.mock("@/lib/fee-token-preparation", () => ({
  ensureFeeTokenBalance: mocks.ensureFeeTokenBalance,
}))

vi.mock("@/lib/hft/hyper-fungible-token", () => ({
  getDestStateMachineId: vi.fn(() => Nexus.stateMachineId),
  getHftRelayerFee: vi.fn(() => 0n),
  getHftTimeout: vi.fn(() => 7200n),
  getHyperFungibleToken: mocks.getHyperFungibleToken,
  isHftToken: vi.fn(() => true),
}))

vi.mock("@/lib/utils/gas", () => ({
  evmFeeOverrides: vi.fn().mockResolvedValue({}),
}))

const BRIDGE_TOKEN = {
  __type: "evm",
  address: "0x5b0c50fdd52ecc0d4c682c441eabad41ffdeabbb",
  decimals: 18,
  hft: {
    defaultRelayerFee: "0",
    defaultTimeout: 7200,
    type: "hft",
  },
  name: "Hyperbridge",
  recipientNetworks: [{ chainId: Nexus.chainId }],
  selfDelivery: false,
  symbol: "BRIDGE",
} as const

function reverseHftParams(source: typeof Bsc | typeof Polygon) {
  return {
    source,
    destination: Nexus,
    bridgeParams: {
      amount: 100000000000000000n,
      destination: Nexus.chainId,
      from: "0x1111111111111111111111111111111111111111",
      recipient: "13MgUGjHXWqNup2VKDyBmM3ENTxHxbd24mZK8RZYCr6JA69g",
      relayerFee: { amount: 0 },
      source: source.chainId,
      timeout: 0,
      token: BRIDGE_TOKEN,
    },
  } as unknown as BridgeParamsHelper
}

describe("HftBridgeTx", () => {
  beforeEach(() => {
    mocks.bridge.mockImplementation(async function* () {
      yield { status: "DESTINATION", type: "status" }
    })
    mocks.getHyperFungibleToken.mockResolvedValue({ bridge: mocks.bridge })
  })

  it.each([Bsc, Polygon])(
    "initializes a $name to Nexus HFT transfer",
    async (source) => {
      const transaction = new HftBridgeTx(reverseHftParams(source))

      await expect(transaction.initialize()).resolves.toBeUndefined()
      expect(mocks.getHyperFungibleToken).toHaveBeenCalledWith(
        source.chainId,
        Nexus.chainId,
      )
    },
  )

  it("encodes a Nexus SS58 recipient as a 32-byte AccountId", async () => {
    const params = reverseHftParams(Bsc)
    const transaction = new HftBridgeTx(params)

    await transaction.initialize()
    for await (const _event of transaction.execute()) {
      // The mocked SDK reaches DESTINATION without yielding transaction events.
    }

    const recipient = params.bridgeParams.recipient
    expect(mocks.bridge).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: Nexus.stateMachineId,
        to: u8aToHex(decodeAddress(recipient, false)),
      }),
    )
  })
})
