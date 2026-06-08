import {
  type HexString,
  type Order as OrderV2,
  orderCommitment,
} from "@hyperbridge/sdk"
import { parseEventLogs } from "viem"
import { INTENT_GATEWAY_V2_ABI } from "@/abis/IntentGatewayV2"
import { bytes32ToEvmAddress } from "@/lib/utils/evm"

/**
 * Normalizes an order into the shape expected by the current SDK runtime.
 *
 * Historical/indexer orders may contain `session` in bytes32-padded form,
 * while the SDK resume/cancel flows currently expect a plain EVM address.
 * This helper keeps that boundary fix in one place.
 */
export function normalizeOrderForSdk(order: OrderV2): OrderV2 {
  const normalizedSession = bytes32ToEvmAddress(order.session, {
    fallbackToInput: true,
  }) as HexString

  return {
    ...order,
    session: normalizedSession,
  }
}

type PlacementReceiptLike = {
  logs?: readonly unknown[]
} | null

type OrderPlacedArgs = {
  user: HexString
  source: HexString
  destination: HexString
  deadline: bigint
  nonce: bigint
  fees: bigint
  session: HexString
  beneficiary: HexString
  predispatch: readonly { token: HexString; amount: bigint }[]
  inputs: readonly { token: HexString; amount: bigint }[]
  outputs: readonly { token: HexString; amount: bigint }[]
}

function parseOrderPlacedArgs(
  receipt: PlacementReceiptLike,
): OrderPlacedArgs | null {
  if (!receipt?.logs?.length) return null

  try {
    const events = parseEventLogs({
      abi: INTENT_GATEWAY_V2_ABI,
      logs: receipt.logs as Parameters<typeof parseEventLogs>[0]["logs"],
      eventName: "OrderPlaced",
    })

    return (events[0]?.args as OrderPlacedArgs | undefined) ?? null
  } catch {
    return null
  }
}

export function deriveCanonicalPlacedOrder(params: {
  sdkOrder: OrderV2
  receipt?: PlacementReceiptLike
}): { order: OrderV2; commitment: HexString } {
  const { sdkOrder, receipt } = params
  const args = parseOrderPlacedArgs(receipt ?? null)

  const canonicalOrder: OrderV2 = args
    ? {
        ...sdkOrder,
        user: args.user,
        source: args.source,
        destination: args.destination,
        deadline: args.deadline,
        nonce: args.nonce,
        fees: args.fees,
        session: args.session,
        predispatch: {
          ...sdkOrder.predispatch,
          assets: args.predispatch.map((asset) => ({
            token: asset.token,
            amount: asset.amount,
          })),
        },
        inputs: args.inputs.map((asset) => ({
          token: asset.token,
          amount: asset.amount,
        })),
        output: {
          ...sdkOrder.output,
          beneficiary: args.beneficiary,
          assets: args.outputs.map((asset) => ({
            token: asset.token,
            amount: asset.amount,
          })),
        },
      }
    : sdkOrder

  const commitment = orderCommitment(canonicalOrder) as HexString

  return {
    order: {
      ...canonicalOrder,
      id: commitment,
    },
    commitment,
  }
}
