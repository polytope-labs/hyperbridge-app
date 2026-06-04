import type { HexString, IPostRequest } from "@hyperbridge/sdk"
import type { ChainId } from "./network-types"
import type { AnyToken, TokenBaseStruct } from "./token"

export type TransferProtocol = {
  kind: "Transfer"
  // amount sent
  amount: number
}

export type InscriptionProtocol = {
  kind: "Inscription"
}

export type BridgeParams = {
  readonly source: ChainId
  readonly from: HexString
  readonly destination: ChainId
  readonly token: AnyToken
  readonly amount: number
  /**
   * eg. Timeout in seconds
   * 3600 -> 1hr
   * 1000 -> 1
   */
  readonly timeout: number
  readonly relayerFee: number
  readonly recipient: HexString
}

export type InscriptionRequestParams = Omit<
  BridgeParams,
  "recipient" | "amount" | "token"
> & {
  message: string
  source: number
  destination: number
}

export type TransactionWriteTag = "stream" | "forced" | "missed"

// The transaction status union
export type TransactionStatus<T extends { kind: string } = { kind: string }> = {
  status: T
  timestamp: number
  write_tag: TransactionWriteTag
}

export interface Legacy_DispatchedRequestWithMeta {
  kind: "Dispatched"
  // block where the request was dispatched
  block_number: bigint
  // the request commitment
  /**  @deprecated Not needed anymore **/
  commitment?: HexString
}

export type SendEvent = MessageStatusWithMeta | Legacy_DispatchedRequestWithMeta
export type SendEventKey = SendEvent["kind"]

export type RollbackEvent = OriginRollbackEvent | Receipt | TimedOut
export type RollbackEventKey = RollbackEvent["kind"]

export type TransactionProtocol = TransferProtocol | InscriptionProtocol

export type Receipt = {
  kind: "Receipt"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

export type TimedOut = {
  kind: "TimedOut"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

export type TxBaseStruct<T extends TransactionProtocol> = {
  // The current request status
  status: SendEventKey | "Pending"

  // What kind of transaction is this
  protocol: T

  originalParams: BridgeParams | InscriptionRequestParams

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
  inflight: OriginSendEvent[]

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

  // underlying request
  request?: IPostRequest

  meta?: unknown[]
  errors: TxError[]

  commitment_hash: HexString | undefined
}

export type TxError = { kind: "InitError"; error: unknown; timestamp: number }

export type InscriptionTx = TxBaseStruct<InscriptionProtocol>
export interface TransferTx extends TxBaseStruct<TransferProtocol> {
  token: Pick<TokenBaseStruct, "symbol" | "name" | "logo">
}

export type BaseTransaction = TransferTx | InscriptionTx

export type TimeoutStreamState =
  | "Pending"
  | DestinationFinalizedState
  | HyperbridgeVerifiedState

export type OriginSendEvent =
  | MessageDispatched
  | SourceFinalizedState
  | HyperbridgeVerifiedState
  | HyperbridgeFinalizedState
// The possible states of a timed-out request

export type OriginRollbackEvent =
  | DestinationFinalizedWithMetadata
  | HyperbridgeVerifiedWithMetadata
  | HyperbridgeFinalizedWithMetadata
  | ErrorWithMetadata

// The possible states of an inflight request
export type MessageStatusWithMeta =
  | SourceFinalizedWithMetadata
  | HyperbridgeVerifiedWithMetadata
  | HyperbridgeFinalizedWithMetadata
  | DestinationDeliveredWithMetadata
  | Timeout
  | ErrorWithMetadata

// This event is emitted on hyperbridge
export interface DestinationFinalizedWithMetadata {
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

// An error was encountered in the stream, the stream will come to an end.
export interface ErrorWithMetadata {
  kind: "Error"
  // error description
  description: string
}

// The request timeout has been finalized by the destination
export interface DestinationFinalizedState {
  // the height of the destination chain at which the timeout was finalized
  DestinationFinalized: bigint
}

// Hyperbridge has finalized some state
export interface HyperbridgeFinalizedState {
  // The height of the state commitment that was finalized
  HyperbridgeFinalized: bigint
}

// The source chain has finalized some state commitment
export interface SourceFinalizedState {
  // The height of the source chain which was finalized
  SourceFinalized: bigint
}

// The message has been verified & aggregated to Hyperbridge
export interface HyperbridgeVerifiedState {
  // Height at which the message was aggregated to Hyperbridge
  HyperbridgeVerified: bigint
}

// Initial state for a pending cross-chain message
export interface MessageDispatched {
  // The height at which the message was dispatched from the source chain
  Dispatched: bigint
}

// The request has now timed out
export interface Timeout {
  kind: "Timeout"
}

// This event is emitted on hyperbridge
export interface SourceFinalizedWithMetadata {
  kind: "SourceFinalized"
  // Block height of the source chain that was finalized.
  finalized_height: bigint
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

// This event is emitted on hyperbridge
export interface HyperbridgeVerifiedWithMetadata {
  kind: "HyperbridgeVerified"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}

// This event is emitted on the destination chain
export interface HyperbridgeFinalizedWithMetadata {
  kind: "HyperbridgeFinalized"
  // Block height of hyperbridge chain that was finalized.
  finalized_height: bigint
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
  // The transaction calldata which can be used for self-relay
  calldata: HexString
}

// This event is emitted on the destination chain
export interface DestinationDeliveredWithMetadata {
  kind: "DestinationDelivered"
  // The hash of the block where the event was emitted
  block_hash: HexString
  // The hash of the extrinsic responsible for the event
  transaction_hash: HexString
  // The block number where the event was emitted
  block_number: bigint
}
