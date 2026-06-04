import { getMultichainTokens } from "../token-registry-helpers"

describe("getMultichainTokens", () => {
  // @ts-expect-error Ignore struct error
  const DOTToken: EVMToken = {
    __type: "evm",
    address: "0x093204",
    name: "Polkadot",
    symbol: "DOT",
    decimals: 10,
    logo: "/images/tokens/dot.png",
  }

  // @ts-expect-error Ignore struct error
  const CereToken: SubstrateToken = {
    __type: "substrate",
    address: "0x02093",
    name: "Cere",
    symbol: "Cere",
    decimals: 10,
    logo: "/images/tokens/dot.png",
    assetId: "0x00000",
  }

  // @ts-expect-error Ignore struct error
  const EthToken: EVMToken = {
    __type: "evm",
    address: "0x02093",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    logo: "/images/tokens/ethereum.png",
  }

  test("should find matching token", () => {
    const hasMatchingTokens = getMultichainTokens({
      sourceTokens: [CereToken, DOTToken, EthToken],
      destTokens: [DOTToken, CereToken],
    }).toArray()

    expect(hasMatchingTokens).toMatchInlineSnapshot(`
      [
        "DOT",
        "Cere",
      ]
    `)
  })
})
