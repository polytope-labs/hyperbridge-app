import { quoteWithConfiguredRelayerFee } from "../hyper-fungible-token"

describe("quoteWithConfiguredRelayerFee", () => {
  it("uses the configured fee without requiring an EVM destination", async () => {
    await expect(
      quoteWithConfiguredRelayerFee({ relayerFee: 7n } as never),
    ).resolves.toEqual({
      relayerFeeInFeeToken: 7n,
      totalFeeTokenCost: 7n,
      totalNativeCost: 0n,
    })
  })

  it("refuses to silently create an unpriced route", async () => {
    await expect(
      quoteWithConfiguredRelayerFee({} as never),
    ).rejects.toThrow("A configured relayer fee is required")
  })
})
