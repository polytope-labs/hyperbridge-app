import type { Prettify } from "@hyperbridge-fe/shared/types"

export * from "@hyperbridge-fe/shared/types"
export * from "@hyperbridge-fe/web3-connect/types"
export * from "./wallet-types"

export type PartialProps<T, Partials extends keyof T> = Prettify<
  Omit<T, Partials> & Partial<Pick<T, Partials>>
>
