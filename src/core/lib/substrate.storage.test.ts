import { decodeAddress } from "@polkadot/util-crypto"
import * as $ from "scale-codec"
import { toHex } from "viem"
import type { RpcUrl } from "@/types"
import { SubstrateBalances } from "./balances/substrate"
import {
  AssetsBalance,
  PalletBalance,
  TokensBalance,
} from "./substrate.storage"
import { HttpRpcClient } from "./substrate-api"

describe.skip("fetch Substrate balances", () => {
  const { fromStorageKey: fetch } = SubstrateBalances

  it("should fetch  balance from an instance of pallet balances", async () => {
    // Initialize the API instance for the given network
    console.log("Creating Api promise")
    const api = createApi("https://rpc.argon.network")

    console.log("Created Api promise")

    const accountId = decodeAddress(
      "12g5mzrFQsUNdJ37VfgN7m7MtTXSa5VZCdx15dmZrcy9Ekm3",
      true,
    )

    console.log("Fetching balance")
    const strategy = new PalletBalance(toHex(accountId), "Ownership")
    const freebalance = await fetch(api, strategy)

    console.log(freebalance)
    expect(freebalance).not.toBeNull()
  })

  it("should fetch asset balance from an instance of pallet assets", async () => {
    // Initialize the API instance for the given network
    console.log("Creating Api promise")
    const api = createApi("https://sys.ibp.network/asset-hub-paseo")

    console.log("Created Api promise")

    const accountId = decodeAddress(
      "15PCbSw1gdtCG9fp1AdLVEQnovPh7LLYWN9krTDAZYhHirSY",
      true,
    )

    const assetId = 50000001
    const encodedAssetId = $.u32.encode(assetId)

    console.log("Fetching balance")
    const strategy = new AssetsBalance(toHex(encodedAssetId), toHex(accountId))
    const freebalance = await fetch(api, strategy)

    console.log(freebalance)
    expect(freebalance).not.toBeNull()
  })

  it(
    "should fetch asset balance from an instance of pallet orml tokens",
    async () => {
      // Initialize the API instance for the given network
      console.log("Creating Api promise")
      const api = createApi("https://bifrost-rpc.paseo.liebi.com/ws")

      console.log("Created Api promise")

      const accountId = decodeAddress(
        "15PCbSw1gdtCG9fp1AdLVEQnovPh7LLYWN9krTDAZYhHirSY",
        true,
      )

      const assetId = new Uint8Array([9, ...$.u8.encode(2)])
      console.log("Fetching balance")

      const strategy = new TokensBalance(
        toHex(assetId),
        toHex(accountId),
        "Tokens",
      )

      const freebalance = await fetch(api, strategy)

      console.log(freebalance)
      expect(freebalance).not.toBeNull()
    },
    { timeout: 40000 },
  )
})

function createApi(url: RpcUrl) {
  return new HttpRpcClient(url)
}
