import type { HexString } from "@hyperbridge/sdk"
import { O } from "../utils/fp.helpers"
import type { MediatorEntry } from "./mediator"
import { Mediator } from "./mediator"
import type { TransactionProgressController } from "./progress-controller"

export type ProgressController =
  | TransactionProgressController
  | (MediatorEntry & EventTarget)

let bridgeMediatorCleanup: () => void = () => {}

/** Called from the Bridge app so transfer UI refreshes when a bridge tx finishes tracking. */
export function registerBridgeMediatorCleanup(fn: () => void) {
  bridgeMediatorCleanup = fn
}

export class TxMediator extends Mediator<ProgressController> {
  constructor(
    private getEntry: (hash: HexString) => O.Option<ProgressController>,
  ) {
    super("TransactionProgressController")
  }

  /**
   * Listen for Transaction completed or timed out events
   */
  listenForChanges(entry: ProgressController) {
    const key = entry.control_key()

    const unregister = () => {
      // todo: During optimization.
      // I noticed this was invoked 3 times on Completion;
      if ("transaction" in entry) {
        bridgeMediatorCleanup()
      }
      this.unregister(key)
    }

    // on timeout
    entry.addEventListener("send/Timeout", unregister)
    // on complete
    entry.addEventListener("send/Destination", unregister)
    // on rollback
    entry.addEventListener("rollback/TimedOut", unregister)
    // on init_error
    entry.addEventListener("error/init", unregister)
  }

  addByHash(hash: string): void {
    const controller = this.getEntry(hash as HexString)

    if (O.isNone(controller)) return

    this.listenForChanges(controller.value)
    super.register(controller.value)
  }
}
