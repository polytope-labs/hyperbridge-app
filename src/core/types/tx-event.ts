import type { Prettify } from "@/lib/utils/types"
import type { AppEventMeta, AppTimeoutEventMeta, RemoteEvent } from "./tx"

type BaseHBEventEventV1 = Prettify<
  RemoteEvent & {
    __tag: "TxEvent"
  }
>

type TxSendEvent = Prettify<
  AppEventMeta & {
    __tag: "TxEvent"
    __path: "send"
  }
>

type TxRollbackEvent = Prettify<
  AppTimeoutEventMeta & {
    __tag: "TxEvent"
    __path: "rollback"
  }
>

type BaseHBEventEventV2 = TxRollbackEvent | TxSendEvent

export type TxEvent = BaseHBEventEventV1 | BaseHBEventEventV2
