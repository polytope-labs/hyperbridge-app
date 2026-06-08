export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Values<T> = T[keyof T]

export type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]

export type OptionalKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never
}[keyof T]
