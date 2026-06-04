import { Paseo } from "@hyperbridge-fe/shared"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import { AssetsManager } from "../assets-manager"
import { AssetManagerStore } from "../assets-store"
import { BalanceHelper } from "../balance-helper"
import { BalanceImpl } from "../factories/balance"
import { O } from "../utils/fp.helpers"
import type { Account, RegistryToken } from "../../types"
import { TokenPriceManager } from "../token-price-manager"
import { BifrostTestnet, Polkadot } from "@hyperbridge-fe/shared/config"

const BNCToken = TokenImpl.substrate({
  name: "Bifrost Native Coin ",
  symbol: "BNC",
  decimals: 12,
  assetId: "0x0001",
  existentialDeposit: 0.01,
  balance: {
    pallet_prefix: "Balances",
    pallet_name: "pallet-balances",
  },
})

function setup() {
  const assetStore = new AssetManagerStore()
  const priceManager = new TokenPriceManager()

  const spiedBalance = vi.mockObject(BalanceHelper)
  const assetManager = new AssetsManager(assetStore, {
    *resolveNetworkAndTokens() {
      yield {
        token: BNCToken,
        network: BifrostTestnet,
      }
    },
    getAccount() {
      return O.some({ address: "0x1234567890abcdef" } as Account)
    },
    balanceHelper: spiedBalance,
    priceManager: priceManager,
  })

  return { assetManager, assetStore, priceManager, spiedBalance }
}

describe("AssetManager", () => {
  test("should fetch balance properly", async () => {
    const { assetManager, spiedBalance } = setup()

    const balance = BalanceImpl.create(12n, 18, "ETH")
    // spiedBalance.transferableBalance.mockResolvedValue(balance)

    const result = assetManager.fetchBalance({
      network: Paseo,
      token: BNCToken,
    })

    await expect(result).resolves.toMatchObject(balance)

    const new_balance = BalanceImpl.create(0n, 18, "ETH")
    spiedBalance.transferableBalance.mockResolvedValue(new_balance)

    const result_01 = assetManager.fetchBalance({
      network: Paseo,
      token: BNCToken,
    })

    await expect(result_01).resolves.toMatchObject(new_balance)
  })
})

it.only("should trigger balance updated event", () => {
  const handler = vi.fn()
  const { assetManager } = setup()

  const token = TokenImpl.create({
    symbol: "CERE",
    name: "CERE Token",
    assetId:
      "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
    decimals: 10,
  } as RegistryToken)

  assetManager.addEventListener("balanceUpdated", handler)

  assetManager.setBalance({
    network: Polkadot,
    token: token,
    balance: BalanceImpl.create(1233990n, token.decimals, token.symbol),
  })

  expect(handler).toHaveBeenCalledOnce()
  const resp = handler.mock.calls[0][0]

  expect(resp.detail.key).toMatchInlineSnapshot(`"0/CERE"`)
  expect(resp.detail.entry).toMatchInlineSnapshot(`
    {
      "balance": {
        "_id": "Option",
        "_tag": "Some",
        "value": {
          "_tag": "app-balance",
          "decimals": 10,
          "symbol": "CERE",
          "value": 1233990n,
        },
      },
      "fiatBalance": {
        "_id": "Option",
        "_tag": "None",
      },
      "network": {
        "chainId": 0,
        "consensus": {
          "layer": "Relay",
          "stateId": "DOT0",
        },
        "disabled": false,
        "estimatedTransferTime": "10 minute",
        "explorer": {
          "contract_url": undefined,
          "transaction_url": "https://assethub-polkadot.subscan.io/extrinsic/[txHash]",
        },
        "group": "relay",
        "logo": "/networks/polkadot.png",
        "name": "Polkadot",
        "networkType": "mainnet",
        "rpcUrls": [
          "wss://sys.ibp.network/asset-hub-polkadot",
          "wss://asset-hub-polkadot-rpc.n.dwellir.com",
        ],
        "stateMachineId": "POLKADOT-3367",
      },
      "token": {
        "__type": "substrate",
        "assetId": "0x179419194813cbeb94161659b59cdd4c4344911a3b58c607679920e08c1aaa2c",
        "decimals": 10,
        "logo": "/networks/cere.svg",
        "name": "CERE Token",
        "symbol": "CERE",
      },
    }
  `)
})
