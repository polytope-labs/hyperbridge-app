/**
 * A utility class for deduplicating concurrent promises with the same key.
 *
 * Example usage:
 * ```typescript
 * const deduper = new DedupePromise();
 *
 * // Multiple calls with the same key will share the same promise execution
 * const fetchUser = (id: string) =>
 *   deduper.execute(
 *     () => `user-${id}`, // key generator
 *     () => fetch(`/api/users/${id}`).then(res => res.json()) // promise factory
 *   );
 *
 * // These three calls will only result in one actual API request
 * const user1 = fetchUser('123');
 * const user2 = fetchUser('123');
 * const user3 = fetchUser('123');
 *
 * // All three promises will resolve with the same result
 * Promise.all([user1, user2, user3]).then(([u1, u2, u3]) => {
 *   console.log(u1 === u2 && u2 === u3); // true
 * });
 * ```
 */
export class DedupePromise {
  private pendingPromises = new Map<string, Promise<unknown>>()
  private pendingResolvers = new Map<
    string,
    Array<{
      resolve: (value: unknown) => void
      reject: (error: unknown) => void
    }>
  >()

  execute<TPromise extends Promise<unknown>>(
    keyGenerator: () => string,
    promiseFactory: () => TPromise,
  ): TPromise {
    const key = keyGenerator()

    return new Promise((resolve, reject) => {
      const existingPromise = this.pendingPromises.get(key)

      if (existingPromise) {
        // Queue this promise to resolve with the same result
        const resolvers = this.pendingResolvers.get(key) || []

        resolvers.push({ resolve, reject })
        this.pendingResolvers.set(key, resolvers)
        return
      }

      // Execute the promise
      const newPromise = promiseFactory()
      this.pendingPromises.set(key, newPromise)

      newPromise
        .then((result) => {
          // Resolve all queued promises with the same result
          const resolvers = this.pendingResolvers.get(key) || []
          resolvers.forEach(({ resolve }) => resolve(result))
          resolve(result)

          // Reset state for this key
          this.pendingPromises.delete(key)
          this.pendingResolvers.delete(key)
        })
        .catch((error) => {
          // Reject all queued promises with the same error
          const resolvers = this.pendingResolvers.get(key) || []
          resolvers.forEach(({ reject }) => reject(error))
          reject(error)

          // Reset state for this key
          this.pendingPromises.delete(key)
          this.pendingResolvers.delete(key)
        })
    }) as TPromise
  }
}
