import type { NetworkTagSimple } from "@hyperbridge-fe/shared"
import { Slot } from "@radix-ui/react-slot"
import { handleConnectWalletClick } from "@/stores/wallet"

export type MultiConnectParams = { network?: NetworkTagSimple; morph?: boolean }

export function HyperBridgeConnectWallet(
  props: {
    children?: React.ReactNode
  } & MultiConnectParams,
) {
  // @todo Can choose preferred network group (evm or polkadot) when opening
  const { children } = props

  return (
    <Slot
      onClick={() => {
        return handleConnectWalletClick()
      }}
    >
      {children}
    </Slot>
  )
}
