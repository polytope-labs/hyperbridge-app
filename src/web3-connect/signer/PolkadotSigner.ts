import { availableNetworks } from "@polkadot/networks"
import { knownGenesis } from "@polkadot/networks/defaults"
import type { Network } from "@polkadot/networks/types"
import { TypeRegistry } from "@polkadot/types"
import type {
  Signer,
  SignerPayloadJSON,
  SignerPayloadRaw,
  SignerResult,
} from "@polkadot/types/types"
import type { HexString } from "@polkadot/util/types"
import type SignClient from "@walletconnect/sign-client"
import type { SessionTypes } from "@walletconnect/types"
import { POLKADOT_CAIP_ID_MAP } from "@/helpers/namespace"

interface Signature {
  signature: HexString
}

export class PolkadotSigner implements Signer {
  registry: TypeRegistry
  client: SignClient
  session: SessionTypes.Struct
  id = 0

  constructor(client: SignClient, session: SessionTypes.Struct) {
    this.client = client
    this.session = session
    this.registry = new TypeRegistry()
  }

  // this method is set this way to be bound to this class.
  signPayload = async (payload: SignerPayloadJSON): Promise<SignerResult> => {
    const chain = genesisHashToChain(payload.genesisHash as `0x${string}`)
    const chainId = POLKADOT_CAIP_ID_MAP[chain?.network]

    try {
      const request = {
        topic: this.session.topic,
        chainId,
        request: {
          id: 1,
          jsonrpc: "2.0",
          method: "polkadot_signTransaction",
          params: {
            address: payload.address,
            transactionPayload: payload,
          },
        },
      }
      const { signature } = await this.client.request<Signature>(request)
      return { id: ++this.id, signature }
    } catch (err) {
      throw new Error(
        `Failed to sign transaction (${payload.genesisHash} ${chain?.network}): ${err}`,
      )
    }
  }

  // this method is set this way to be bound to this class.
  // It might be used outside of the object context to sign messages.
  // ref: https://polkadot.js.org/docs/extension/cookbook#sign-a-message
  signRaw = async (raw: SignerPayloadRaw): Promise<SignerResult> => {
    const chainId = POLKADOT_CAIP_ID_MAP.hydration
    const request = {
      topic: this.session.topic,
      chainId,
      request: {
        id: 1,
        jsonrpc: "2.0",
        method: "polkadot_signMessage",
        params: { address: raw.address, message: raw.data },
      },
    }
    const { signature } = await this.client.request<Signature>(request)
    return { id: ++this.id, signature }
  }
}

const genesisHashToChain = (genesisHash?: `0x${string}`) => {
  let chainInfo = availableNetworks.find(
    (c) => c.network === "substrate",
  ) as Network

  if (!genesisHash) return chainInfo

  for (const chain in knownGenesis) {
    if (knownGenesis[chain].includes(genesisHash)) {
      const chainIndex = availableNetworks.findIndex((entry) =>
        chain.startsWith(entry.network),
      )

      if (chainIndex >= 0) {
        chainInfo = availableNetworks[chainIndex]
        break
      }
    }
  }

  return chainInfo
}
