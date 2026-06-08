import {
  Bifrost,
  type ChainId,
  type SubstrateToken,
} from "@hyperbridge-fe/shared"
import { SubstrateBalances } from "../substrate"
import type { HexString } from "@/types/tx"

it("get the correct storage key", async () => {
  const params = {
    chainId: Bifrost.chainId as ChainId,
    walletAddr: "13nAyWdhs7wDhsF6enKpaWLcJgWwgaCdJfHYnZU7e1GoLek1" as HexString,
    tokens: tokens,
  } as const

  const batchHandler = SubstrateBalances.batch(params)

  expect(batchHandler.getKeys()).toMatchInlineSnapshot(`
    [
      "0xc2261276cc9d1f8598ea4b6a74b15c2fb99d880ec681799c0cf30e8886371da951c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff346b0eee53168ff3720801",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34e749fed2d14dab5e0803",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34d7711bfe851930780900",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff347a993ca12348fc520101",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34b788e2160690b0a90903",
      "0x99971b5749ac43e0235e41b0d37869188ee7418a6531173d60d1f6a82d8f4d5151c4ebbbd90641cb4a6cef511aad4ebc7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34759191d2a31597a60901",
    ]
  `)
})

const tokens = [
  {
    __type: "substrate",
    assetId: "0x0001",
    balance: {
      pallet_name: "pallet-balances",
      pallet_prefix: "Balances",
    },
    decimals: 12,
    existentialDeposit: 0.01,
    logo: "/tokens/bnc.svg",
    name: "Bifrost Native Coin ",
    symbol: "BNC",
  },
  {
    __type: "substrate",
    assetId: "0x0801",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 18,
    existentialDeposit: 0.00001,
    logo: "https://cdn.liebi.com/press_kit/GLMR.svg",
    name: "GLMR",
    symbol: "GLMR",
  },
  {
    __type: "substrate",
    assetId: "0x0803",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 18,
    existentialDeposit: 0.01,
    logo: "https://cdn.liebi.com/press_kit/ASTR.svg",
    name: "ASTR",
    symbol: "ASTR",
  },
  {
    __type: "substrate",
    assetId: "0x0900",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 10,
    existentialDeposit: 0.01,
    logo: "https://cdn.liebi.com/press_kit/vDOT.svg",
    name: "Voucher DOT",
    symbol: "vDOT",
  },
  {
    __type: "substrate",
    assetId: "0x0101",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 12,
    logo: "https://cdn.liebi.com/press_kit/vBNC.svg",
    name: "Voucher BNC",
    symbol: "vBNC",
  },
  {
    __type: "substrate",
    assetId: "0x0903",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 18,
    existentialDeposit: 0.01,
    logo: "https://cdn.liebi.com/press_kit/vASTR.svg",
    name: "Voucher ASTR",
    symbol: "vASTR",
  },
  {
    __type: "substrate",
    assetId: "0x0901",
    balance: {
      pallet_name: "orml-tokens",
      pallet_prefix: "Tokens",
    },
    decimals: 18,
    existentialDeposit: 0.00001,
    logo: "https://cdn.liebi.com/press_kit/vGLMR.svg",
    name: "Voucher GLMR",
    symbol: "vGLMR",
  },
] as unknown as SubstrateToken[]
