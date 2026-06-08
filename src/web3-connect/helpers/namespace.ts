import { EVM_NETWORKS } from "@hyperbridge-fe/shared/config"
import type { EVMChainConfig } from "@hyperbridge-fe/shared/types"

export const POLKADOT_CAIP_ID_MAP: Record<string, string> = {
  polkadot: "polkadot:91b171bb158e2d3848fa23a9f1c25182",
  acala: "polkadot:fc41b9bd8ef8fe53d58c7ea67c794c7e",
  assethub: "polkadot:68d56f15f85d3136970ec16946040bc1",
  astar: "polkadot:9eb76c5184c4ab8679d2d5d819fdf90b",
  bifrost: "polkadot:262e1b2ad728475fd6fe88e62d34c200",
  centrifuge: "polkadot:b3db41421702df9a7fcac62b53ffeac8",
  crust: "polkadot:4319cc49ee79495b57a1fec4d2bd43f5",
  interlay: "polkadot:bf88efe70e9e0e916416e8bed61f2b45",
  nodle: "polkadot:97da7ede98d7bad4e36b4d734b605542",
  phala: "polkadot:1bb969d85965e4bb5a651abbedf21a54",
  subsocial: "polkadot:4a12be580bb959937a1c7a61d5cf2442",
  unique: "polkadot:84322d9cddbf35088f1e54e9a85c967a",
  zeitgeist: "polkadot:1bf2a2ecb4a868de66ea8610f2ce7c8c",
}

const evmChainsArr = Object.values(EVM_NETWORKS).filter(
  (chain): chain is EVMChainConfig =>
    Boolean(chain) &&
    typeof chain === "object" &&
    "group" in chain &&
    "chainId" in chain &&
    chain.group === "evm" &&
    Boolean(chain.chainId) &&
    Array.isArray(chain.rpcUrls) &&
    chain.rpcUrls.length > 0,
)

const POLKADOT_CHAIN_IDS = Object.values(POLKADOT_CAIP_ID_MAP)

export const namespaces = {
  eip155: {
    chains: evmChainsArr.map(({ chainId }) => `eip155:${chainId}`),
    methods: [
      "eth_sendTransaction",
      "eth_signTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData_v4",
      "eth_signTypedData",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ],
    events: ["chainChanged", "accountsChanged"],
    rpcMap: evmChainsArr.reduce((prev, curr) => {
      if (curr.chainId) {
        // @ts-expect-error Expected warning
        prev[curr.chainId] = curr.rpcUrls[0]
      }
      return prev
    }, {}),
  },
  polkadot: {
    methods: ["polkadot_signTransaction", "polkadot_signMessage"],
    chains: POLKADOT_CHAIN_IDS,
    events: ["accountsChanged", "disconnect"],
  },
}

export type NamespaceType = keyof typeof namespaces
