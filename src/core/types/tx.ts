import type {
  AllStatusKey as AllStatusKey_,
  HexString,
  IPostRequest,
} from "@hyperbridge/sdk"
import type { Hex } from "viem"
import type {
  BridgeParams,
  ChainId,
  FiatValue,
  InscriptionRequestParams,
  Prettify,
  TokenBaseStruct,
} from "@/types"
import type {
  DestinationDeliveredWithMetadata,
  HyperbridgeFinalizedWithMetadata,
  HyperbridgeVerifiedWithMetadata,
  MessageStatusStreamState,
  TimeoutStatusWithMeta as OriginRollbackEvent,
  MessageStatusWithMeta as OriginSendEvent,
  SourceFinalizedWithMetadata,
  Timeout,
  TimeoutStreamState,
} from "@/types/hyperclient"
import type { TraceMeta } from "./user-tracking"

export type { HexString, IPostRequest } from "@hyperbridge/sdk"

export type TxMode = "rollback" | "send"

// biome-ignore lint/suspicious/noExplicitAny: PublicClient type slowes down the Typescript linter
export type PublicClient = any

export interface RootHelperParams
  extends Omit<BridgeParams, "relayerFee" | "amount"> {
  amount: bigint
  /**
   * Relayer fee in USD
   */
  relayerFee: FiatValue
}

export type AppBridgeParams =
  | RootHelperParams
  | BridgeParams
  | InscriptionRequestParams

// The possible states of an inflight request
export type AppEventMeta =
  | SourceFinalizedWithMetadata
  | HyperbridgeVerifiedWithMetadata
  | HyperbridgeFinalizedWithMetadata
  | DestinationDeliveredWithMetadata
  | Timeout

export type AppTimeoutEventMeta =
  | DestinationFinalizedWithMetadata
  | HyperbridgeVerifiedWithMetadata
  | HyperbridgeFinalizedWithMetadata
  | TimedOut

export type RemoteEvent = AppTimeoutEventMeta | AppEventMeta

// This event is emitted on hyperbridge
interface DestinationFinalizedWithMetadata {
  kind: "DestinationFinalized"
  // Block height of the destination chain that was finalized.
  finalized_height: bigint
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

/* deprecated interface */
export type RemoteRollbackEvent = OriginRollbackEvent

export type TxResumptionPayload =
  | {
      network: "evm"
      type: "resumption_params"
      transaction_hash: HexString
    }
  | {
      network: "relay"
      type: "resumption_params"
      nonce: string
      transaction_hash: HexString
      message_id: HexString | undefined
    }

/** Events that emit before tracking begins */
export type TxCreationEvents =
  | {
      kind: "Ready"
      transaction_hash: HexString
      meta: TxResumptionPayload[]
    }
  | {
      kind: "Finalized"
      transaction_hash: HexString
      message_id: HexString
    }
  | {
      kind: "IPostRequest"
      request: IPostRequest
      transaction_hash: HexString
    }
  | {
      kind: "CommitmentHash"
      transaction_hash: HexString
      commitment_hash: HexString
    }
  | {
      kind: "InBlock"
      transaction_hash: HexString
      block_number: bigint
    }
  | {
      kind: "Verified"
      transaction_hash: HexString
      block_hash: HexString
      block_number: bigint
    }
  | {
      kind: "Error"
      // should have a tx_hash in the case
      // where  Ready event was emitted before Error
      transaction_hash?: HexString
      error: string | TxError
    }
  | {
      kind: "Closed"
    }

export type StreamEvent<TEvent> =
  | {
      kind: "Close"
      _emitter: string
    }
  | {
      kind: "Timeout"
      _emitter: string
    }
  | {
      kind: "Progress"
      value: TEvent
      _emitter: string
    }
  | {
      kind: "Error"
      error: Error
      _emitter: string
    }

export type StatusKey = AllStatusKey_

export type LegacyTxStatusKey = SendEventKey | RollbackEventKey

export type ExplicitStatusKey =
  | `${"send"}/${SendEventKey}`
  | `${"rollback"}/${RollbackEventKey}`

type Receipt = {
  kind: "Receipt"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

type TransferProtocol = {
  kind: "Transfer"
  // amount sent
  amount: number
}

type InscriptionProtocol = {
  kind: "Inscription"
}

interface Legacy_DispatchedRequestWithMeta {
  kind: "Dispatched"
  // block where the request was dispatched
  block_number: bigint
  // the request commitment
  /**  @deprecated Not needed anymore **/
  commitment?: HexString
}

export type SendEvent = OriginSendEvent | Legacy_DispatchedRequestWithMeta
export type SendEventKey = SendEvent["kind"]

type TimedOut = {
  kind: "TimedOut"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

export type RollbackEvent = OriginRollbackEvent | Receipt | TimedOut
export type RollbackEventKey = RollbackEvent["kind"]

export type TransactionWriteTag = "stream" | "forced" | "missed"

// The transaction status union
export type TransactionStatus<T extends { kind: string } = { kind: string }> = {
  status: T
  timestamp: number
  write_tag: TransactionWriteTag
}

type TransactionProtocol = TransferProtocol | InscriptionProtocol

type TxBaseStruct<T extends TransactionProtocol> = {
  // The current request status
  status: SendEventKey | "Pending"

  // What kind of transaction is this
  protocol: T

  originalParams: AppBridgeParams

  networkEnv: "mainnet" | "testnet"

  // collected progress so far
  progress: {
    [K in SendEventKey]?: TransactionStatus<SendEvent>
  }

  // collected timeout progress so far
  timeoutProgress: {
    [K in RollbackEventKey]?: TransactionStatus<RollbackEvent>
  }

  // all previous states for the message
  inflight: MessageStatusStreamState[]

  // all previous states for the timeout
  timeout: TimeoutStreamState[]

  // When this transaction started
  createdAt: number

  // The transaction hash of the request
  transaction_hash: HexString

  // source chain
  source: ChainId

  // destination chain
  destination: ChainId

  // The relayer fee associated with this request
  relayerFee: number

  // flag to set if transaction has been completed
  completed?: boolean
  completedAt?: number

  // underlying request
  request?: IPostRequest

  meta?: unknown[]
  errors: TxError[]

  commitment_hash: HexString | undefined
  tracing?: TraceMeta
}

/**
 * Expected ErrorException Order. InitError
 */
export type TxError = {
  kind: "InitError"
  error: unknown
  timestamp: number
}

export type InscriptionTx = TxBaseStruct<InscriptionProtocol>
export interface TransferTx extends TxBaseStruct<TransferProtocol> {
  token: Pick<TokenBaseStruct, "symbol" | "name" | "logo">
}

export type Transaction = TransferTx | InscriptionTx

type ValuesOf<T> = T[keyof T]
export type WrittenEvent = Exclude<
  ValuesOf<Prettify<Transaction["progress"] | Transaction["timeoutProgress"]>>,
  undefined
>

export type TimelineNode = {
  key: ExplicitStatusKey
  children: TimelineNode[]
}

export type ProofData = {
  height: {
    stateMachineId: bigint
    height: bigint
  }
  leafCount: bigint
  multiproof: Hex[]
  responses: Array<{
    index: bigint
    kIndex: bigint
    response: {
      request: unknown
      values: unknown[]
    }
  }>
}

export type FixedRenderStruct = Record<ExplicitStatusKey, ExplicitStatusKey[]>
