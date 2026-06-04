import { computed, observable, runInAction } from "mobx"
import { rootLogger } from "../logger"

const logger = rootLogger.withTag("Mediator")

export type RunningState = "idle" | "stop" | "running" | "paused" | "completed"

export interface MediatorEntry {
  status: RunningState
  control_key: () => string
  start: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
}

export class Mediator<TEntry extends MediatorEntry> {
  private record = observable.map(new Map<string, TEntry>(), { deep: false })

  constructor(private entryLabel: string) {}

  active_transactions = computed(() => {
    return new Map(
      Iterator.from(this.record).filter(([, controller]) => {
        return controller.status === "running"
      }),
    )
  })

  get(hash: string) {
    return this.record.get(hash)
  }

  private add(control: TEntry) {
    const key = control.control_key()

    if (this.record.has(key)) return
    logger.trace(`Registering ${this.entryLabel}`, key)

    runInAction(() => {
      this.record.set(key, control)
    })
  }

  has(hash: string) {
    return this.record.has(hash)
  }

  remove(hash: string) {
    if (this.record.has(hash)) {
      logger.trace(`Removing ${this.entryLabel}`, hash)
      runInAction(() => {
        this.record.delete(hash)
      })
    }
  }

  getStatus(hash: string) {
    return this.record.get(hash)?.status
  }

  async stop(hash?: string) {
    if (hash) {
      const controller = this.record.get(hash)
      if (controller) {
        logger.trace(`Stopping ${this.entryLabel}`, hash)

        await controller.stop()
      }
    } else {
      logger.trace(`Stopping all ${this.entryLabel}s`)
      for (const [, controller] of this.record.entries()) {
        await controller.stop()
      }
    }
  }

  async start(hash?: string) {
    if (hash) {
      const controller = this.record.get(hash)

      if (!controller) {
        throw new Error(`Failed to resolve ${this.entryLabel}`)
      }

      logger.trace(`Resuming ${this.entryLabel}`, hash)
      await controller.start()
    } else {
      for (const [, controller] of this.record.entries()) {
        await controller.start()
      }
    }
  }

  register(entry: TEntry) {
    const key = entry.control_key()

    if (!this.record.has(key)) {
      this.add(entry)
    }
  }

  unregister(key: string) {
    if (!this.record.has(key)) return
    const controller = this.record.get(key)

    if (!controller) {
      throw new Error(`Failed to resolve ${this.entryLabel}`)
    }

    logger.trace(`Removing ${this.entryLabel}`, key)
    runInAction(() => {
      this.record.delete(key)
    })
  }
}
