/**
 * Type definitions
 */
export * from "./network-types"
export * from "./token"
export * from "./transaction"
export * from "./utils"

export type Maybe<T> = T | undefined | null
export type AppEnv = "production" | "staging" | "local"

// biome-ignore lint/suspicious/noExplicitAny: veim `Chain` type is too complex and slows down Typescript compiler
type Chain = any
export interface ViemChain extends Chain {}
