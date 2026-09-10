import type { NetworkConfig } from "@hyperbridge-fe/shared/types"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import {
  Arbitrum,
  BscTestnet,
  Gargantua,
  Nexus,
  Sepolia,
} from "@hyperbridge-fe/shared/config"
import { CereTestnet } from "@hyperbridge-fe/shared/config"
import {
  isEVMChain,
  isRelayChain,
  resolveNetworkGroup,
} from "@hyperbridge-fe/shared"
import { O } from "@/lib/utils/fp.helpers"
import { DEFAULT_HASH } from "@/lib/utils"
import { Paseo, Polkadot } from "@hyperbridge-fe/shared/config"

describe("validateSourceDest", () => {
  const validateSourceDest = NetworkImpl.validateSourceDest

  const mainnetNetwork = {
    networkType: "mainnet",
  } as NetworkConfig

  const testnetNetwork = {
    networkType: "testnet",
  } as NetworkConfig

  it("should return success when both networks exist and are on the same network type", () => {
    const networks = {
      source: mainnetNetwork,
      dest: mainnetNetwork,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      source: mainnetNetwork,
      dest: mainnetNetwork,
    })
  })

  it("should fail when source network is missing", () => {
    const networks = {
      source: null,
      dest: mainnetNetwork,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Source/Destination chain doesn't exist")
  })

  it("should fail when destination network is missing", () => {
    const networks = {
      source: mainnetNetwork,
      dest: null,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Source/Destination chain doesn't exist")
  })

  it("should fail when both networks are missing", () => {
    const networks = {
      source: null,
      dest: null,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Source/Destination chain doesn't exist")
  })

  it("should fail when networks are on different network types", () => {
    const networks = {
      source: mainnetNetwork,
      dest: testnetNetwork,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      "Both source and destination should on the same NetworkEnvironment(testnet|mainnet)",
    )
  })

  it("should succeed with testnet networks", () => {
    const networks = {
      source: testnetNetwork,
      dest: testnetNetwork,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      source: testnetNetwork,
      dest: testnetNetwork,
    })
  })

  it("should fail when networks are undefined", () => {
    const networks = {
      source: undefined,
      dest: undefined,
    }

    const result = validateSourceDest(networks)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Source/Destination chain doesn't exist")
  })
})

describe("stateMachineId", () => {
  it("should throw an error for AssetHub network", () => {
    expect(() => {
      NetworkImpl.stateMachineId({ group: "assetHub" } as NetworkConfig)
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: AssetHub network doesn't have a StateMachineId]`,
    )
  })
})

describe("Hyperbridge network classification", () => {
  it.each([Nexus.chainId, Gargantua.chainId])(
    "classifies chain %s as a Substrate relay network",
    (chainId) => {
      expect(isRelayChain(chainId)).toBe(true)
      expect(isEVMChain(chainId)).toBe(false)
      expect(resolveNetworkGroup(chainId)).toBe("substrate")
    },
  )
})

describe("match()", () => {
  it("should match networks group", () => {
    const records = [
      [Paseo, 3],
      [Sepolia, 1],
      [CereTestnet, 2],
      [null, 5],
      [undefined, 5],
    ] as const

    const matchers = {
      evm: () => 1,
      substrate: () => 2,
      relay: () => 3,
      assetHub: () => 4,
      _: () => 5,
    }

    for (const [config, expected_value] of records) {
      const current_value = NetworkImpl.match(config, matchers)

      expect(expected_value).toBe(current_value)
    }
  })

  it("should return invalid input as fallback args", () => {
    const matchers = {
      evm: () => 1,
      _: vi.fn(() => 0),
    }

    const value = NetworkImpl.match(null, matchers)

    expect(matchers._).toBeCalledWith(null)
    expect(matchers._).toHaveBeenCalledOnce()
    expect(value).toBe(0)
  })
})

describe("safeTxUrl()", () => {
  it("should fail when invalid hash is provided", () => {
    const invalids = [null, undefined, "", DEFAULT_HASH]

    for (const hash of invalids) {
      // @ts-expect-error
      const item = NetworkImpl.safeTxUrl(CereTestnet, hash)
      expect(O.isNone(item)).toBe(true)
    }
  })

  it("should return SOME when a valid hash is provided", () => {
    const item = NetworkImpl.safeTxUrl(
      CereTestnet,
      "0x123f681646d4a755815f9cb19e1acc8565a0c2ac8e",
    )

    expect(O.isSome(item)).toBe(true)
  })
})

describe("Sorting", () => {
  it("should move disabled networks to the end of the list", () => {
    const networks = [
      { ...Polkadot, disabled: true },
      Sepolia,
      Arbitrum,
      { ...CereTestnet, disabled: true },
      BscTestnet,
    ]

    const value = networks
      .toSorted(NetworkImpl.sort_move_disabled_to_end)
      .map((network) => network.name)

    expect(value).toMatchObject([
      "Sepolia",
      "Arbitrum",
      "BSC Testnet",
      "Polkadot",
      "Cere Testnet",
    ])
  })

  it("should sort alphabetically", () => {
    const networks = [Polkadot, Sepolia, Arbitrum, CereTestnet, BscTestnet]

    const value = networks
      .toSorted(NetworkImpl.sort_alphabetically)
      .map((network) => network.name)

    expect(value).toMatchObject([
      "Arbitrum",
      "BSC Testnet",
      "Cere Testnet",
      "Polkadot",
      "Sepolia",
    ])
  })
})
