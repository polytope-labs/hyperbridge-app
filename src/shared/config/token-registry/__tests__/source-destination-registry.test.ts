import { CereTestnet } from "@/config/registry/substrate-networks"
import { Paseo } from "@/config/registry/relay-networks"
import { Sepolia } from "@/config/registry/evm-networks"
import { SourceDestinationIndexer } from "../source-destination-registry"
import { UnitTestTokenRegistry } from "./shared"
import { omit } from "effect/Struct"

describe(
  "SourceDestinationIndexer",
  () => {
    it("should index within 10 milliseconds", () => {
      const now = performance.now()
      new SourceDestinationIndexer(UnitTestTokenRegistry)
      const execTime = performance.now() - now

      // index time should be less than 10 milliseconds
      expect(execTime).toBeLessThanOrEqual(10)
    })

    it("Should index correctly", () => {
      const indexer = new SourceDestinationIndexer(UnitTestTokenRegistry)
      const record = {}

      for (const [key, value] of indexer.value.entries()) {
        // @ts-expect-error
        record[key] = omit(value, "recipientNetworks")
      }

      expect(record).toMatchInlineSnapshot(`
      {
        "CERE/11155111/SUBSTRATE-cere": {
          "assetId": "0xf310641B4B6c032D0c88d72d712C020fCa9805A3",
          "decimals": 18,
          "name": "Cere",
          "symbol": "CERE",
        },
        "CERE/SUBSTRATE-cere/11155111": {
          "assetId": "0x00000000000000000000000000000000",
          "decimals": 10,
          "name": "Cere",
          "symbol": "CERE",
        },
      }
    `)
    })

    it("should find a token by source and destination", () => {
      const indexer = new SourceDestinationIndexer(UnitTestTokenRegistry)
      const sepolia_cere_token = UnitTestTokenRegistry[Sepolia.chainId][1]
      const cere_cere_token = UnitTestTokenRegistry[CereTestnet.chainId][0]

      const token_details = indexer.lookup({
        token_symbol: "CERE",
        source: Sepolia.chainId,
        destination: CereTestnet.chainId,
      })
      const reverse = indexer.lookup({
        token_symbol: "CERE",
        source: CereTestnet.chainId,
        destination: Sepolia.chainId,
      })

      expect(token_details).toBe(sepolia_cere_token)
      expect(reverse).toBe(cere_cere_token)
    })

    it("should return UNDEFINED if no match is found", () => {
      const indexer = new SourceDestinationIndexer(UnitTestTokenRegistry)

      const token_details = indexer.lookup({
        token_symbol: "CERE",
        source: Sepolia.chainId,
        destination: Paseo.chainId,
      })

      expect(token_details).toBeUndefined()
    })

    it("should return source and destinations for a token", () => {
      const indexer = new SourceDestinationIndexer(UnitTestTokenRegistry)

      expect(indexer.find_transfer_pair("CERE").toArray())
        .toMatchInlineSnapshot(`
      [
        [
          11155111,
          "SUBSTRATE-cere",
        ],
        [
          "SUBSTRATE-cere",
          11155111,
        ],
      ]
    `)

      const time_to_completion = performance.measure(
        "time_to_completion",
        "find_transfer_pair/lookup/started",
        "find_transfer_pair/lookup/end",
      )
      const time_to_find = performance.measure(
        "time_to_find",
        "find_transfer_pair/lookup/started",
        "find_transfer_pair/lookup/find-match",
      )

      expect(time_to_find.duration).toBeLessThanOrEqual(10)
      expect(time_to_completion.duration).toBeLessThanOrEqual(10)
    })
  },
  {
    concurrent: true,
  },
)
