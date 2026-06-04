import type { HexString } from "@polkadot/util/types"
import { Equal, Hash } from "effect"
import { u32 } from "scale-codec"
import { bytesToHex, hexToBytes, isHex, keccak256 } from "viem"
import tokenImages from "@/config/registry/token-images.json"
import { safeObj, safeStr } from "@/lib/data.helpers"
import { O } from "@/lib/utils/fp.helpers"
import type { Maybe, NetworkConfig } from "@/types"
import type {
  AnyToken,
  EVMToken,
  RegistryToken,
  SubstrateToken,
} from "@/types/token"

export const TokenImpl = {
  type(token: AnyToken) {
    return token?.__type
  },

  expectType(token: AnyToken, type: "evm" | "substrate") {
    type Bob = typeof type extends "evm" ? EVMToken : SubstrateToken

    if (TokenImpl.type(token) !== type) {
      return O.none()
    }

    return O.some(token as Bob)
  },

  is(value: unknown): value is SubstrateToken | EVMToken {
    // @ts-expect-error
    return TokenImpl.validate(safeObj(value))
  },

  validate(token: Maybe<AnyToken>): token is AnyToken {
    return token?.__type === "evm" || token?.__type === "substrate"
  },

  evm(token: Omit<EVMToken, "__type">): EVMToken {
    // @ts-expect-error Casting to EVM
    return { ...token, __type: "evm" as const }
  },

  substrate(token: Omit<SubstrateToken, "__type">): SubstrateToken {
    // @ts-expect-error Casting to substrate
    return { ...token, __type: "substrate" as const }
  },

  /** Gets the asset Id for token based on type */
  assetId(token: AnyToken) {
    return TokenImpl.match(token, {
      evm: (v) => {
        const encoder = new TextEncoder()
        return keccak256(encoder.encode(v.symbol))
      },
      substrate: (v) => v.assetId,
      _: () => undefined,
    })
  },

  create(token: RegistryToken) {
    const hasBothAddressAndAssetId = "address" in token && "assetId" in token

    if (hasBothAddressAndAssetId) {
      console.assert(
        hasBothAddressAndAssetId,
        `Token(${token.symbol}) should have either an assetId or an address property. Never both`,
      )
    }

    const logo = safeStr((tokenImages as Record<string, string>)[token.symbol])
    const types = new Set(["evm", "substrate"] as const)

    // use specified type if exists
    if (token.type && types.has(token.type)) {
      if (token.type === "substrate") {
        // @todo: validate structural data using a validation library
        if (typeof token.existentialDeposit !== "number") {
          throw new Error(
            `existentialDeposit is required for Substrate token. Reading ${token.symbol}`,
          )
        }
      }

      const { type, ...rest } = token

      return TokenImpl[type]({ ...rest, logo })
    }

    // start inference
    if ("assetId" in token) {
      return TokenImpl.substrate({ ...token, logo })
    }

    return TokenImpl.evm({ ...token, logo })
  },

  match<T>(
    token: Maybe<AnyToken>,
    matchHandler: {
      evm?: (a: EVMToken) => T
      substrate?: (a: SubstrateToken) => T
      _: (a: Maybe<AnyToken>) => T
    },
  ): T {
    if (token?.__type === "evm" && matchHandler.evm) {
      return matchHandler.evm(token)
    }

    if (token?.__type === "substrate" && matchHandler.substrate) {
      return matchHandler.substrate(token)
    }

    return matchHandler._(token)
  },

  addressUrl(token: AnyToken, network: NetworkConfig) {
    return TokenImpl.match(token, {
      evm: (v) => {
        return safeStr(network.explorer?.contract_url).replace(
          "[reference]",
          v.address,
        )
      },
      _: () => null,
    })
  },

  isRedeemable(token: AnyToken) {
    return TokenImpl.match(token, {
      evm: (v) => v.redeemable,
      _: () => false,
    })
  },

  compare(token: AnyToken) {
    if (!TokenImpl.is(token)) {
      throw new Error("Can only compare EVMToken and SubstrateToken structures")
    }

    return { ...token, __proto__: PROTOTYPE }
  },
}

const PROTOTYPE = {
  ...({} as AnyToken),
  // Define equality based on id, name, and age
  [Equal.symbol](that: Equal.Equal): boolean {
    if (TokenImpl.is(that)) {
      return (
        Equal.equals(this.__type, that.__type) &&
        Equal.equals(this.name, that.name) &&
        Equal.equals(this.symbol, that.symbol) &&
        Equal.equals(this.decimals, that.decimals)
      )
    }
    return false
  },

  [Hash.symbol](): number {
    return Hash.structure({
      __type: this.__type,
      name: this.name,
      symbol: this.symbol,
      decimals: this.decimals,
    })
  },
}

type AssetIdFormats =
  | {
      value: number
      format: "number"
    }
  | {
      value: HexString
      format: "encoded-hex"
    }
  | {
      value: Uint8Array
      format: "encoded-bytes"
    }

/**
 * Encode and decode assetId of any type as u32
 */
export class AssetIdCodec {
  private state: AssetIdFormats

  constructor(value: AssetIdFormats) {
    this.state = value
  }

  decode(): number {
    if (this.state.format === "encoded-hex") {
      return u32.decode(hexToBytes(this.state.value))
    }

    if (this.state.format === "number") {
      return this.state.value
    }

    return u32.decode(this.state.value)
  }

  encode(): Uint8Array {
    if (this.state.format === "encoded-bytes") {
      return this.state.value
    }

    if (this.state.format === "encoded-hex") {
      return u32.encode(Number.parseInt(this.state.value))
    }

    return u32.encode(this.state.value)
  }

  encodeToHex() {
    const value = this.encode()
    if (isHex(value)) return value

    return bytesToHex(value)
  }

  static parse(value: unknown) {
    if (value instanceof Uint8Array) {
      return new AssetIdCodec({
        format: "encoded-bytes",
        value: value,
      })
    }

    if (isHex(value)) {
      return new AssetIdCodec({
        format: "encoded-hex",
        value: value,
      })
    }

    if (typeof value === "number") {
      return new AssetIdCodec({ format: "number", value })
    }

    throw new Error(
      `ParseError: Invalid assetId value. Expected number or hex but got ${typeof value}`,
    )
  }
}
