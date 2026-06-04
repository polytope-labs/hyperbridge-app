import { Keyring } from "@polkadot/api"
import { rootLogger } from "./logger"

export function encodePolkaAddress(polkaAddress?: string): string {
  if (!polkaAddress) return ""

  try {
    const keyring = new Keyring()
    return keyring.encodeAddress(polkaAddress, 0)
  } catch (err) {
    const error = new Error(`Failed to encode ${polkaAddress}`, { cause: err })
    rootLogger.error(error)
    return polkaAddress // return the original address if it fails to encode
  }
}
