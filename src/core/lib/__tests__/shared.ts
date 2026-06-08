import type {
  RollbackEvent,
  SendEvent,
  SendEventKey,
  Transaction,
  LegacyTxStatusKey,
} from "@/types/tx"
import { JSONParse } from "json-with-bigint"
import type { DeepPartial } from "react-hook-form"
import { merge as deepMerge } from "lodash-es"
import { Polkadot_to_Bsc_Tx } from "../factories/__tests__/shared"
import { delay } from "@/lib/utils/async.helpers"
import { TxImpl } from "@/lib/factories/transaction"
import { O } from "../utils/fp.helpers"
import { TxWriteImpl } from "../factories/tx-event"
import { isRelayChain, type RollbackEventKey } from "@hyperbridge-fe/shared"

export const Relay_to_Evm = (
  overwrites?: DeepPartial<Transaction>,
): Transaction => {
  return deepMerge(Polkadot_to_Bsc_Tx, overwrites)
}

export const Evm_to_Polkadot: () => Transaction = () =>
  JSONParse(
    '{"transaction_hash":"0x230021102bb4b817763f777e8a1d636f281e0bd82119f8be84996dc58d360940","protocol":{"kind":"Transfer","amount":1},"source":97,"destination":-1,"token":{"name":"Polkadot","symbol":"DOT","address":"0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114","decimals":18,"recipientNetworks":[],"logo":"/tokens/dot.svg","__type":"evm"},"relayerFee":0,"progress":{"Dispatched":{"status":{"kind":"Dispatched","block_number":48564488},"timestamp":1740415999904}},"timeoutProgress":{},"completed":false,"createdAt":1740415984307,"status":"Dispatched","inflight":[{"Dispatched":48564488}],"timeout":[],"originalParams":{"source":97,"destination":-1,"amount":1,"timeout":3600,"recipient":"13nAyWdhs7wDhsF6enKpaWLcJgWwgaCdJfHYnZU7e1GoLek1","relayerFee":0,"token":{"name":"Polkadot","symbol":"DOT","address":"0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114","decimals":18,"recipientNetworks":[],"logo":"/tokens/dot.svg","__type":"evm"},"from":"0xc4cE6549C5F26de05898AB6E99005f0DBcd0D83a"},"meta":[{"type":"resumption_params","network":"evm","transaction_hash":"0x230021102bb4b817763f777e8a1d636f281e0bd82119f8be84996dc58d360940"}],"request":{"from":"0xFcDa26cA021d5535C3059547390E6cCd8De7acA6","source":"EVM-97","dest":"KUSAMA-4009","to":"0xfcda26ca021d5535c3059547390e6ccd8de7aca6","nonce":367,"timeoutTimestamp":1740419586,"body":"0x000000000000000000000000000000000000000000000000000de0b6b3a76400009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34","fee":0}}',
  )

export const Evm_to_Evm = (
  overwrites?: DeepPartial<Transaction>,
): Transaction => {
  const value = JSONParse<Transaction>(
    '{"transaction_hash":"0x3276d05ce621af2ce0f46e018704bb3495c06ef65eaea36851d982e7c1a2624d","protocol":{"kind":"Transfer","amount":2},"source":97,"destination":84532,"token":{"name":"Polkadot","symbol":"DOT","address":"0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114","decimals":18,"recipientNetworks":[],"logo":"/tokens/dot.svg","__type":"evm"},"relayerFee":0,"progress":{"Dispatched":{"status":{"kind":"Dispatched","block_number":48564581},"timestamp":1740416271928},"SourceFinalized":{"status":{"kind":"SourceFinalized","finalized_height":48564600,"block_hash":"0x02e909673e7152f5a06b27b9f1c791fe4a0c28f26d003b6b221b13a7c609afc8","transaction_hash":"0xf133ccf05e615d3a500407de3103095af0eb5e1322e8c2f8146d8c17da3a6991","block_number":3855488},"timestamp":1740416335902},"HyperbridgeVerified":{"status":{"kind":"HyperbridgeVerified","block_hash":"0x385b69877ce965fe28a61b5ffffebee3532ca6772d85882802a5815b39f65f11","transaction_hash":"0x769b3ebbea74911b789f8ca15e1e37dc16fa9c5336eca93b48b2cdce03a110a1","block_number":3855501},"timestamp":1740416440648},"HyperbridgeFinalized":{"status":{"kind":"HyperbridgeFinalized","finalized_height":3855503,"block_hash":"0x3e6fe9ef3047b0b680c0b642129efc011a9ccab0adbc4fe05eb805397a34a0aa","transaction_hash":"0xa8c703a7daf9846b4ee47d5ab5f4e98137f1650e1aef5aa756f1c8bef609edcb","block_number":22324093,"calldata":"0x9d38eb35000000000000000000000000d198c01839dd4843918617afd1e4ddf44cc3bb4a0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000002600000000000000000000000000000000000000000000000000000000000000fa900000000000000000000000000000000000000000000000000000000003ad48f0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000007476c000000000000000000000000000000000000000000000000000000000000000c2b0207ea2d401d5b6592d3f755ed6ae125db76f4b6423ce2d4cd537be33811fa39b6386bd26c421196f723be1697e8a7a8d1ef2d111e51273f3c021226ac82131bd5142b51d6b4223ac4acd852bd370d0d4a8a94a889966ad6447935cd8f27254f5038c51216a035c72be0546d0c1fb9252084d0b3ea21f8348d0073e3030cc5e296d2877a7e767c0c1b4b529d9f53543dac5b48ecc0a25b211ab42b2f4cdc971d33dccb73e74e11cc9c9fc7a28826192c7d817ae7204e254bc00abcd128aa4941545fdf9b9ccd70d541552ba7a2a5f72ddb0a212a0bcb7675344ad74beb082d0555123886a280db16febb566c8bd31963e8faf4194fdd8b8d6db6cbda2370910359ef10f41d90f93545cbab5583ca1de89a792738109c95d0f8651d712a2427745d9686d635b52f706daf23ab8d107c22e020d7faefc947d17b4a29e9c82fa0c3962bfd26a47a49d1ba73faa376a65207942580794229abd78dc19771f66338f19ea737f89ea59896d0a2bae4ad4b6a4a4ae3dbeaaaed91002aec3e2d5ea68c000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000007476b000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000067bcb31900000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000000645564d2d39370000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000945564d2d383435333200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014fcda26ca021d5535c3059547390e6ccd8de7aca60000000000000000000000000000000000000000000000000000000000000000000000000000000000000014fcda26ca021d5535c3059547390e6ccd8de7aca600000000000000000000000000000000000000000000000000000000000000000000000000000000000000a1000000000000000000000000000000000000000000000000001bc16d674ec800009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a00000000000000000000000000000000000000000000000000000000000000"},"timestamp":1740416505168},"DestinationDelivered":{"status":{"kind":"DestinationDelivered"},"timestamp":1740416779934}},"timeoutProgress":{},"completed":true,"createdAt":1740416261960,"status":"DestinationDelivered","inflight":[{"Dispatched":48564581},{"SourceFinalized":48564600},{"HyperbridgeVerified":3855501},{"HyperbridgeFinalized":3855503}],"timeout":[],"originalParams":{"source":97,"destination":84532,"amount":2,"timeout":3600,"recipient":"0xc4cE6549C5F26de05898AB6E99005f0DBcd0D83a","relayerFee":0.00083794,"token":{"name":"Polkadot","symbol":"DOT","address":"0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114","decimals":18,"recipientNetworks":[],"logo":"/tokens/dot.svg","__type":"evm"},"from":"0xc4cE6549C5F26de05898AB6E99005f0DBcd0D83a"},"meta":[{"type":"resumption_params","network":"evm","transaction_hash":"0x3276d05ce621af2ce0f46e018704bb3495c06ef65eaea36851d982e7c1a2624d"}],"request":{"from":"0xFcDa26cA021d5535C3059547390E6cCd8De7acA6","source":"EVM-97","dest":"EVM-84532","to":"0xfcda26ca021d5535c3059547390e6ccd8de7aca6","nonce":368,"timeoutTimestamp":1740419865,"body":"0x000000000000000000000000000000000000000000000000001bc16d674ec800009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a","fee":837940000000000}}',
  )

  if (!overwrites) return value

  return deepMerge(value, overwrites)
}

const standard_tx_flow: LegacyTxStatusKey[] = [
  "Dispatched",
  "SourceFinalized",
  "HyperbridgeVerified",
  "HyperbridgeFinalized",
  "DestinationDelivered",
]

export const TxTestUtils = {
  freezeForSend(
    stop_status: SendEventKey | "Pending",
    original_tx: Transaction,
  ): Transaction {
    const cloned_tx = structuredClone(original_tx)
    const flow: SendEventKey[] = [
      "Dispatched",
      "SourceFinalized",
      "HyperbridgeVerified",
      "HyperbridgeFinalized",
      "DestinationDelivered",
    ]
    const cloned_progress = structuredClone(cloned_tx.progress)

    cloned_tx.progress = {}
    cloned_tx.status = stop_status
    cloned_tx.completed = false

    for (const status of flow) {
      const value = cloned_progress[status]
      if (value) {
        cloned_tx.progress[status] = value
      }
      if (status === stop_status) break
    }

    return cloned_tx
  },

  freezeAt<T extends "send" | "rollback">(
    stop_status:
      | (T extends "send" ? SendEventKey : RollbackEventKey)
      | "Pending",
    original_tx: Transaction,
    mode_: T,
  ): Transaction {
    const mode = mode_ ?? "send"
    const cloned_tx = structuredClone(original_tx)

    const config = {
      send: {
        property: "progress",
        flow: [
          "Dispatched",
          "SourceFinalized",
          "HyperbridgeVerified",
          "HyperbridgeFinalized",
          "DestinationDelivered",
        ] as SendEventKey[],
      },
      rollback: {
        property: "timeoutProgress",
        flow: [
          "Destination",
          "HyperbridgeVerified",
          "HyperbridgeFinalized",
          "Receipt",
        ] as RollbackEventKey[],
      },
    } as const

    function updateProperties(mode_: typeof mode) {
      const { property, flow } = config[mode_]

      const progress = structuredClone(cloned_tx[property])

      if (Object.keys(progress).length === 0) {
        throw new Error(
          `[TxTestUtils] '${property}' object is empty. Expecting Transaction Snapshot with timeoutProgress`,
        )
      }

      // @ts-expect-error
      cloned_tx.status = stop_status
      cloned_tx.completed = false

      for (const status of flow) {
        // @ts-expect-error
        const value = progress[status]
        if (value) {
          // @ts-expect-error
          cloned_tx[property][status] = value
        }

        if (status === stop_status) {
          // @ts-expect-error
          cloned_tx.status = stop_status
          break
        }
      }

      return cloned_tx
    }

    return updateProperties(mode)
  },

  resetTxState(tx: Transaction): Transaction {
    const cloned_tx = structuredClone(tx)
    const isInProgress = !TxImpl.is_timed_out(cloned_tx)
    cloned_tx.status = "Pending"

    if (isInProgress) {
      cloned_tx.progress = {}
      cloned_tx.inflight = []
    }

    cloned_tx.completed = false
    cloned_tx.timeoutProgress = {}
    cloned_tx.timeout = !isInProgress ? ["Pending"] : []

    return cloned_tx
  },

  async *replay(params: {
    transaction: Transaction
    stop_status: LegacyTxStatusKey
    flow?: LegacyTxStatusKey[]
    action?: "send" | "rollback"
    duration?: number
  }) {
    const {
      duration = 2000,
      stop_status,
      transaction: tx,
      action = "send",
      flow = standard_tx_flow,
    } = params

    const cloned_tx = structuredClone(tx)
    cloned_tx.status = "Dispatched"

    const prop_map = {
      send: "progress",
      rollback: "timeoutProgress",
    } as const

    const prop = prop_map[action]
    cloned_tx[prop] = {}
    cloned_tx.status =
      action === "rollback" ? (stop_status as SendEventKey) : "Timeout"

    for (const status of flow) {
      await delay(duration)
      const value = O.getOrUndefined(TxImpl.read_any_event(tx, status))

      if (value) yield value

      if (status === stop_status) break
    }
  },
}

/**
 * Mimicks the mutation in TransactionStore.progressRequest
 * @param tx
 * @param status
 * @returns
 */
export function writeSuccessEvent(tx: Transaction, status: SendEvent) {
  if (
    !tx || // unknown tx
    status.kind === tx.status || // known status
    tx.progress[status.kind]?.status !== undefined // known status
  ) {
    return
  }

  const statuses: SendEventKey[] = [
    "Dispatched",
    "SourceFinalized",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
    "DestinationDelivered",
  ]

  // advance any statuses that might have been missed
  for (const s of statuses) {
    const stat = s as SendEventKey
    if (s === status.kind || status.kind === "Timeout") {
      break
    }

    if (tx.progress[stat]?.status.kind === undefined) {
      tx.progress[stat] = {
        status: { kind: stat },
        timestamp: Date.now(),
        // biome-ignore lint/suspicious/noExplicitAny: Using any for progress state casting
      } as any
    }
  }

  switch (status.kind) {
    case "Dispatched": {
      if (status.block_number !== 0n) {
        tx.inflight.push({
          Dispatched: status.block_number,
        })
      }
      break
    }
    case "SourceFinalized": {
      if (status.finalized_height !== 0n) {
        tx.inflight.push({
          SourceFinalized: status.finalized_height,
        })
      }
      break
    }

    case "HyperbridgeVerified": {
      if (status.block_number !== 0n) {
        tx.inflight.push({
          HyperbridgeVerified: status.block_number,
        })
      }
      break
    }

    case "HyperbridgeFinalized": {
      if (status.finalized_height !== 0n) {
        tx.inflight.push({
          HyperbridgeFinalized: status.finalized_height,
        })
      }
      break
    }

    case "Timeout": {
      if (!isRelayChain(tx.destination)) {
        tx.timeout.push("Pending")
      }
      tx.status = "Timeout"
      break
    }
  }

  // add the new status
  tx.status = status.kind
  tx.progress[status.kind] = TxWriteImpl.create("stream", {
    status,
    timestamp: Date.now(),
  })

  if (
    status.kind === "DestinationDelivered" ||
    (isRelayChain(tx.destination) && status.kind === "HyperbridgeVerified")
  ) {
    tx.completed = true
    tx.completedAt = Date.now()
  }
}

/**
 * Mimicks the mutation in TransactionStore.progressTimedOutRequest
 * @param tx
 * @param status
 * @returns
 */
export function writeTimeoutEvent(
  transaction: Transaction,
  status: RollbackEvent,
) {
  if (!transaction || transaction.status === "Timeout") {
    return
  }

  const statuses = [
    "DestinationFinalized",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
    "Receipt",
  ]

  // advance any statuses that might have been missed
  for (const s of statuses) {
    const stat = s as SendEventKey
    if (s === status.kind) {
      break
    }

    if (transaction.progress[stat]?.status.kind === undefined) {
      transaction.progress[stat] = {
        status: { kind: stat },
        timestamp: Date.now(),
        // biome-ignore lint/suspicious/noExplicitAny: Using any for progress state casting
      } as any
    }
  }

  switch (status.kind) {
    case "DestinationFinalized": {
      if (status.finalized_height !== 0n) {
        transaction.timeout.push({
          DestinationFinalized: status.finalized_height,
        })
      }
      break
    }

    case "HyperbridgeVerified": {
      if (status.block_number !== 0n) {
        transaction.timeout.push({
          HyperbridgeVerified: status.block_number,
        })
      }
      break
    }
  }

  transaction.timeoutProgress[status.kind] = TxWriteImpl.create("stream", {
    status,
    timestamp: Date.now(),
  })

  const is_complete =
    isRelayChain(transaction.source) && status.kind === "HyperbridgeVerified"

  if (status.kind === "Receipt" || is_complete) {
    transaction.completed = true
  }
}
