import { matchChain } from "@hyperbridge-fe/shared"
import { Slot } from "@radix-ui/react-slot"
import type React from "react"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { useAsyncLoader } from "@/hooks/use-loader"
import { rootLogger } from "@/lib/logger"
import { WalletManager } from "@/lib/wallet-manager"
import type { ChainId } from "@/types"

export function AddToWalletButtonAction(
  props: React.ComponentProps<"button"> & {
    network: ChainId
    asset: { name: string; symbol: string; logo?: string }
    asChild?: boolean
  },
) {
  const { asset, network, asChild, ...PROPS } = props
  const { attachLoader, loading } = useAsyncLoader({
    default: false,
  })

  const Component = asChild ? Slot : "button"

  return matchChain(network, {
    _: () => null,
    none: () => null,
    evm: () => {
      return (
        <Component
          {...PROPS}
          onClick={(evt) => {
            props.onClick?.(evt)

            const token = tokenRegistry.getBySymbol(network, asset.symbol)
            if (!(network && token)) return null

            const request = attachLoader("default", () =>
              WalletManager.addTokenToWallet(network, token).then(() => {
                return new Promise((resolve) => {
                  setTimeout(() => resolve(true), 2000)
                })
              }),
            )

            request().catch((err) => {
              return rootLogger.error("Error occurred trying to add token", err)
            })
          }}
        >
          {loading.default ? "Requesting..." : "Add to wallet"}
        </Component>
      )
    },
  })
}
