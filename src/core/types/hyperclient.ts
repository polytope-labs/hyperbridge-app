import type { HexString } from "@hyperbridge/sdk"

export type TimeoutStreamState =
  | "Pending"
  | DestinationFinalizedState
  | HyperbridgeVerifiedState

export type MessageStatusStreamState =
  | MessageDispatched
  | SourceFinalizedState
  | HyperbridgeVerifiedState
  | HyperbridgeFinalizedState
// The possible states of a timed-out request
export type TimeoutStatusWithMeta =
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

// An error was encountered in the stream, the stream will come to an end.
interface ErrorWithMetadata {
  kind: "Error"
  // error description
  description: string
}

// The request timeout has been finalized by the destination
interface DestinationFinalizedState {
  // the height of the destination chain at which the timeout was finalized
  DestinationFinalized: bigint
}

// Hyperbridge has finalized some state
interface HyperbridgeFinalizedState {
  // The height of the state commitment that was finalized
  HyperbridgeFinalized: bigint
}

// The source chain has finalized some state commitment
interface SourceFinalizedState {
  // The height of the source chain which was finalized
  SourceFinalized: bigint
}

// The message has been verified & aggregated to Hyperbridge
interface HyperbridgeVerifiedState {
  // Height at which the message was aggregated to Hyperbridge
  HyperbridgeVerified: bigint
}

// Initial state for a pending cross-chain message
interface MessageDispatched {
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
