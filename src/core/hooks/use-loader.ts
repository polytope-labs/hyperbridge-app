import React from "react"

const update =
  <Props extends Record<string, unknown>>(key: string, value: boolean) =>
  (getter: Props) => ({
    ...getter,
    [key]: value,
  })

export function useLoading<T extends string>(_defaults: Record<T, boolean>) {
  const [loading, _setLoading] = React.useState(_defaults)

  const set = React.useEffectEvent((key: T, value: boolean) => {
    _setLoading(update(String(key), value))
  })

  return {
    loading,
    setLoading: (key: T, value: boolean) => set(key, value),
    startLoading: (key: T) => set(key, true),
    stopLoading: (key: T) => set(key, false),
  }
}

export const useAsyncLoader = <T extends string>(param: Record<T, boolean>) => {
  const { loading, setLoading } = useLoading<T>(param)
  const attachLoader = React.useMemo(
    () => asyncLoading<T>(setLoading),
    [setLoading],
  )

  return {
    loading,
    attachLoader,
  }
}

/** this is a development hook for testing events **/
export const useFakerXHR = ({ timeout }: { timeout: number }) => {
  const loader = useAsyncLoader({ default: false })

  return {
    loading: loader.loading.default,
    fire: loader.attachLoader("default", () => {
      return new Promise((res) => setTimeout(res, timeout))
    }),
  }
}

type ExtractVariadicFn<Fn> = Fn extends (...a: infer P) => Promise<infer R>
  ? (...a: P) => Promise<R>
  : (...a: unknown[]) => Promise<unknown>

export const asyncLoading = <K>(
  setLoading: (key: K, state: boolean) => void,
) => {
  return <Fn>(key: K, asyncCallback: Fn): ExtractVariadicFn<Fn> =>
    // @ts-expect-error Complex typing not necessary
    (...args) => {
      setLoading(key, true)
      // @ts-expect-error Complex typing not necessary
      return asyncCallback(...args).finally(() => {
        setLoading(key, false)
      })
    }
}
