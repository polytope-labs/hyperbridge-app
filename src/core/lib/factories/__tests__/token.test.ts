import type { HexString } from "@polkadot/util/types"
import { TokenImpl, AssetIdCodec } from "@hyperbridge-fe/shared/factories"
import type {
  RegistryToken,
  SubstrateToken,
} from "@hyperbridge-fe/shared/types"

describe("TokenImpl.create", () => {
  it("should infer substrate token type", () => {
    const token = TokenImpl.create({
      symbol: "CERE",
      name: "CERE Token",
      assetId:
        "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
      decimals: 10,
    } as RegistryToken)

    expect(token.__type).toEqual("substrate")
  })

  it("should throw when existentialDeposit is missing for substrate token", () => {
    const create = () =>
      TokenImpl.create({
        type: "substrate",
        symbol: "CERE",
        name: "CERE Token",
        assetId:
          "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
        decimals: 10,
      } as RegistryToken)

    expect(create).toThrow(
      "existentialDeposit is required for Substrate token. Reading CERE",
    )
  })

  it("should overwrite infereance when `type` property is set", () => {
    const substrate = TokenImpl.create({
      type: "substrate",
      symbol: "CERE",
      name: "CERE Token",
      existentialDeposit: 1,
      assetId:
        "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
      decimals: 10,
    } as RegistryToken)

    const evm = TokenImpl.create({
      type: "evm",
      symbol: "DOT",
      name: "Polkadot",
      assetId:
        "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
      decimals: 10,
    } as RegistryToken)

    expect(substrate.__type).toBe("substrate")
    expect(evm.__type).toBe("evm")
  })
})

it("should infer EVM token type", () => {
  const token = TokenImpl.create({
    symbol: "CERE",
    name: "CERE Token",
    address: "0x0304920390293423",
    decimals: 10,
  } as RegistryToken)

  expect(token.__type).toEqual("evm")
})

describe("AssetId", () => {
  describe("parse", () => {
    it("should parse hex string values", () => {
      const hexValue = "0x0123"
      const assetId = AssetIdCodec.parse(hexValue)
      expect(assetId).toBeInstanceOf(AssetIdCodec)
    })

    it("should throw error for invalid types", () => {
      const invalidValues = ["abc", true, {}, [], null, undefined]

      for (const value of invalidValues) {
        expect(() => AssetIdCodec.parse(value)).toThrow(
          `Invalid assetId value. Expected number or hex but got ${typeof value}`,
        )
      }
    })
  })

  describe("decode", () => {
    it("should decode scale-encoded value to number", () => {
      const scale_encoded_value: HexString = "0x81f0fa02" // scale-encoded

      const assetId = new AssetIdCodec({
        format: "encoded-hex",
        value: scale_encoded_value,
      })

      const decoded = assetId.decode()
      expect(decoded).toBe(50000001)
    })

    it("should decode number value to number", () => {
      const assetIdInHex = 50000001

      const assetId = AssetIdCodec.parse(assetIdInHex)
      const decoded = assetId.decode()

      expect(decoded).toBe(50000001)
    })
  })

  describe("edge cases", () => {
    it("should handle zero value", () => {
      const assetId = AssetIdCodec.parse(0)
      expect(assetId.decode()).toBe(0)
    })
  })
})

describe("TokenImpl.assetId()", () => {
  it("should get ASSET_ID from EVMToken", () => {
    const token = TokenImpl.evm({
      symbol: "DOT",
      name: "Polkadot",
      decimals: 10,
      address: "0x030492039",
    })

    expect(TokenImpl.assetId(token)).toBe(
      "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f",
    )
  })

  it("should get ASSET_ID from Substrate", () => {
    const substrateToken: SubstrateToken = TokenImpl.substrate({
      symbol: "DOT",
      name: "Polkadot",
      decimals: 10,
      assetId: "0xASSET_ID",
    })

    expect(TokenImpl.assetId(substrateToken)).toBe("0xASSET_ID")
  })
})
