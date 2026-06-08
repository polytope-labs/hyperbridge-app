import { CereTestnet, Paseo } from "@/config/registry/networks"
import { TokenNetworkIndexer } from "../token-network-indexer"
import { UnitTestTokenRegistry } from "./shared"

describe("TokenNetworkIndexer", () => {
  it("should index within 10 milliseconds", () => {
    const now = performance.now()
    new TokenNetworkIndexer(UnitTestTokenRegistry)
    const execTime = performance.now() - now

    // index time should be less than 10 milliseconds
    expect(execTime).toBeLessThanOrEqual(10)
  })

  it("Should index correctly", () => {
    const indexer = new TokenNetworkIndexer(UnitTestTokenRegistry)

    expect(indexer.value.size).toBe(17)
  })

  it("should find a token by source and destination", () => {
    const indexer = new TokenNetworkIndexer(UnitTestTokenRegistry)
    const cere_cere_token = UnitTestTokenRegistry[CereTestnet.chainId][0]

    const token_details = indexer.lookup({
      token_symbol: "CERE",
      source: CereTestnet.chainId,
    })

    expect(token_details).toBe(cere_cere_token)
  })

  it("should return UNDEFINED if no match is found", () => {
    const indexer = new TokenNetworkIndexer(UnitTestTokenRegistry)

    const token_details = indexer.lookup({
      token_symbol: "CERE",
      source: Paseo.chainId,
    })

    expect(token_details).toBeUndefined()
  })
})
