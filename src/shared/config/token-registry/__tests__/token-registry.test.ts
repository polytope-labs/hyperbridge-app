import { Ethereum, Cere, Polkadot } from "@/config/registry/networks"
import { TokenRegistry } from "@/config/token-registry/token-registry"
import { TokenImpl } from "@/factories"
import type { RegistryToken } from "@/types"

const CereSubstrateToken: RegistryToken = {
  name: "Cere",
  symbol: "CERE",
  assetId: "0x00000000000000000000000000000000",
  decimals: 10,
  existentialDeposit: 1,
  balance: {
    pallet_prefix: "Balances",
    pallet_name: "pallet-balances",
  },
  recipientNetworks: [Ethereum],
}

const CereEVMToken = {
  name: "Cere",
  symbol: "CERE",
  address: "0x2dA719DB753dFA10a62E140f436E1d67F2ddB0d6",
  decimals: 10,
  recipientNetworks: [Cere],
}

const instance = new TokenRegistry({
  [Cere.chainId]: [CereSubstrateToken],
  [Ethereum.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: "0x030492032",
      decimals: 18,
      recipientNetworks: [Polkadot],
    },
    CereEVMToken,
  ],
})

describe("TokenRegistry", () => {
  it("find_transferable_token", () => {
    const [substrate_token] = Array.from(
      instance.find_transferable_token({
        source: Cere.chainId,
        destination: Ethereum.chainId,
      }),
    )

    const [evm_token] = Array.from(
      instance.find_transferable_token({
        source: Ethereum.chainId,
        destination: Cere.chainId,
      }),
    )

    expect(TokenImpl.type(substrate_token)).toBe("substrate")
    expect(TokenImpl.type(evm_token)).toBe("evm")

    expect(substrate_token).not.toMatchObject(evm_token)
  })

  it("getByChain", () => {
    const all = instance.getByChain(Cere.chainId)

    expect(all.map((e) => [e.__type, e.symbol].join("-"))).toMatchObject([
      "substrate-CERE",
    ])
  })

  describe("isTransferable", () => {
    it("non-strict", () => {
      const is_transferable = instance.isTransferable({
        strict: false,
        source: Cere.chainId,
        destination: Ethereum.chainId,
        token_symbol: "CERE",
      })

      expect(is_transferable).toBe(true)
    })

    it("strict", () => {
      const is_transferable = instance.isTransferable({
        strict: true,
        source: Cere.chainId,
        destination: Ethereum.chainId,
        token: TokenImpl.create(CereSubstrateToken),
      })

      const is_transferable_2 = instance.isTransferable({
        strict: true,
        source: Cere.chainId,
        destination: Ethereum.chainId,
        token: TokenImpl.create(CereEVMToken),
      })

      expect(is_transferable).toBe(true)
      expect(is_transferable_2).toBe(false)
    })
  })
})
