/**
 * @description https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
 */
export const scheduler_yield = async (): Promise<void> => {
  // @ts-expect-error Scheduler not in global
  if (globalThis.scheduler?.yield) {
    // @ts-expect-error Scheduler not in global
    await scheduler.yield()
  }
}
