import type { HexString } from "@polkadot/util/types"
import {
  blake2AsU8a,
  decodeAddress,
  xxhashAsHex,
  xxhashAsU8a,
} from "@polkadot/util-crypto"
import { isNil } from "lodash-es"
import * as $ from "scale-codec"
import { u128 } from "scale-codec"
import { bytesToHex, hexToBytes } from "viem"
import type { SubstrateToken } from "@/types"

export interface SubstrateBalanceStorage {
  getStorageKey(): string
  decodeData: (value: HexString) => bigint
}

function decodeFree(value: HexString): bigint {
  const bytes = hexToBytes(value)
  const decoded = u128.decode(bytes)

  return BigInt(decoded)
}

const Account = $.object(
  $.field("nonce", $.u32),
  $.field("consumers", $.u32),
  $.field("providers", $.u32),
  $.field("sufficients", $.u32),
  $.field(
    "data",
    $.object(
      $.field("free", $.u128),
      $.field("reserve", $.u128),
      $.field("frozen", $.u128),
      $.field("flags", $.u128),
    ),
  ),
)

function decodeSystem(data: HexString) {
  const bytes = hexToBytes(data)
  const decoded = Account.decode(bytes)

  return BigInt(decoded.data.free.toString())
}

export class PalletBalance implements SubstrateBalanceStorage {
  constructor(
    public accountId: HexString,
    public palletPrefix: string,
  ) {}

  decodeData = (hex_string: HexString) => {
    if (this.palletPrefix === "System") {
      return decodeSystem(hex_string)
    }

    return decodeFree(hex_string)
  }

  getStorageKey() {
    const { palletPrefix: pallet_prefix, accountId } = this

    // twox_128
    const palletPrefix = xxhashAsU8a(pallet_prefix, 128)
    // twox_128
    const storagePrefix = xxhashAsU8a("Account", 128)

    // blake2_128
    const key = blake2AsU8a(accountId, 128)

    const encodedAccount = $.sizedUint8Array(32).encode(hexToBytes(accountId))

    const full_key = new Uint8Array([
      ...palletPrefix,
      ...storagePrefix,
      ...key,
      ...encodedAccount,
    ])

    const hexKey = bytesToHex(full_key)

    return hexKey
  }
}

export class AssetsBalance implements SubstrateBalanceStorage {
  constructor(
    public assetId: HexString,
    public accountId: HexString,
    public palletPrefix: string = "Assets",
  ) {}

  decodeData = decodeFree

  getStorageKey() {
    const { palletPrefix: pallet_prefix, assetId, accountId } = this

    // twox_128
    const palletPrefix = xxhashAsU8a(pallet_prefix, 128)

    // twox_128
    const storagePrefix = xxhashAsU8a("Account", 128)

    const key_1 = blake2AsU8a(hexToBytes(assetId), 128)

    // blake2_128
    const key_2 = blake2AsU8a(accountId, 128)

    const encodedAccount = $.sizedUint8Array(32).encode(hexToBytes(accountId))

    const full_key = new Uint8Array([
      ...palletPrefix,
      ...storagePrefix,
      ...key_1,
      ...hexToBytes(assetId),
      ...key_2,
      ...encodedAccount,
    ])

    const hexKey = bytesToHex(full_key)
    return hexKey
  }
}

export class TokensBalance implements SubstrateBalanceStorage {
  constructor(
    public assetId: HexString,
    public accountId: HexString,
    public palletPrefix: string = "Tokens",
  ) {}

  decodeData = decodeFree

  getStorageKey() {
    const { palletPrefix: pallet_prefix, assetId, accountId } = this

    // twox_128
    const palletPrefix = xxhashAsU8a(pallet_prefix, 128)

    // twox_128
    const storagePrefix = xxhashAsU8a("Accounts", 128)

    // blake2_128
    const key_1 = blake2AsU8a(accountId, 128)

    const key_2 = xxhashAsU8a(hexToBytes(assetId), 64)

    const encodedAccount = $.sizedUint8Array(32).encode(hexToBytes(accountId))

    const full_key = new Uint8Array([
      ...palletPrefix,
      ...storagePrefix,
      ...key_1,
      ...encodedAccount,
      ...key_2,
      ...hexToBytes(assetId),
    ])

    const hexKey = bytesToHex(full_key)

    return hexKey
  }
}

class SystemBalance implements SubstrateBalanceStorage {
  constructor(public accountId: string) {}

  decodeData = decodeSystem

  getStorageKey() {
    const accountId = this.accountId

    const palletHash = xxhashAsHex("System", 128)
    const storageHash = xxhashAsHex("Account", 128)
    const accountIdBytes = decodeAddress(accountId)
    const accountIdHashed = blake2AsU8a(accountIdBytes, 128)

    const finalKey = new Uint8Array([
      ...hexToBytes(palletHash),
      ...hexToBytes(storageHash),
      ...accountIdHashed,
      ...accountIdBytes,
    ])

    return bytesToHex(finalKey)
  }
}

export function getBalanceFetchingStrategy(
  token: Pick<SubstrateToken, "balance">,
  params: {
    asset_id: HexString
    account_id: HexString
  },
): SubstrateBalanceStorage {
  if (isNil(token.balance)) {
    return new SystemBalance(params.account_id)
  }

  if (token.balance.pallet_name === "pallet-balances")
    return new PalletBalance(params.account_id, token.balance.pallet_prefix)

  if (token.balance.pallet_name === "orml-tokens") {
    return new TokensBalance(
      params.asset_id,
      params.account_id,
      token.balance.pallet_prefix,
    )
  }

  if (token.balance.pallet_name === "pallet-assets") {
    return new AssetsBalance(
      params.asset_id,
      params.account_id,
      token.balance.pallet_prefix,
    )
  }

  throw new Error("Failed to fetch content. Unsupported Balance Type")
}
