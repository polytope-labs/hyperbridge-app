import { testnetAddresses } from "@/config/addresses"
import {
  ArbitrumSepolia,
  AssethubPaseo,
  BaseSepolia,
  BscTestnet,
  Chiado,
  OptimismSepolia,
  Paseo,
  Sepolia,
} from "@/config/registry/networks"
import { CereTestnet } from "@/config/registry/substrate-networks"
import type { ChainTokenRegistry } from "@/types/token"

/** @ts-expect-error */
export const UnitTestTokenRegistry: ChainTokenRegistry = {
  [CereTestnet.chainId]: [
    {
      name: "Cere",
      symbol: "CERE",
      assetId: "0x00000000000000000000000000000000",
      decimals: 10,
      recipientNetworks: [Sepolia],
    },
  ],

  [Paseo.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
  ],

  [AssethubPaseo.chainId]: [
    {
      name: "USDH",
      symbol: "USDH",
      assetId: "0x81f0fa02",
      decimals: 6,
      recipientNetworks: [],
    },
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
  ],

  [Sepolia.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "Cere",
      symbol: "CERE",
      assetId: "0xf310641B4B6c032D0c88d72d712C020fCa9805A3",
      decimals: 18,
      recipientNetworks: [CereTestnet],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
  [BaseSepolia.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
  [ArbitrumSepolia.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
  [OptimismSepolia.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
  [BscTestnet.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
  [Chiado.chainId]: [
    {
      name: "Polkadot",
      symbol: "DOT",
      address: testnetAddresses.dotAddress,
      decimals: 18,
      recipientNetworks: [],
    },
    {
      name: "USD coin",
      symbol: "USDH",
      address: "0xA801da100bF16D07F668F4A49E1f71fc54D05177",
      decimals: 18,
      recipientNetworks: [],
    },
  ],
}
