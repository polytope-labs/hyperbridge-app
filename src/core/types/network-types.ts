import type { NetworkConfig } from "@hyperbridge-fe/shared"
import type { WalletProviderType } from "@hyperbridge-fe/web3-connect"
import type { HexString } from "./tx"

export type NetworkConfigWithDescription = NetworkConfig & {
  description: string
}

export type HBUIAccount = {
  address: HexString
  wallet: {
    name: string
    image: string
  }
  network: {
    name: string
    image: string
  }
  displayAddress?: string
  provider?: WalletProviderType
}
