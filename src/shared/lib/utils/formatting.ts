import { decodeAddress, encodeAddress } from "@polkadot/util-crypto"
import { getAddress as getEvmAddress } from "viem"
import type { Maybe } from "@/types"

export function shortenAccountAddress(address: string, length = 6) {
  return `${address.substring(0, length)}...${address.substring(
    address.length - length,
  )}`
}

export function safeConvertAddressSS58(
  address: Maybe<string>,
  ss58prefix: number,
) {
  try {
    return encodeAddress(decodeAddress(address), ss58prefix)
  } catch {
    return null
  }
}

export function safeConvertAddressH160(value: string): string | null {
  try {
    return getEvmAddress(value?.toLowerCase())
  } catch {
    return null
  }
}

export function approximateFraction(formatter_: Intl.NumberFormat) {
  return (value: number | bigint | Intl.StringNumericLiteral): string => {
    let isTrimmed: boolean = false

    const parts = formatter_.formatToParts(value).map((e) => {
      if (e.type === "nan") return "--"

      if (e.type === "fraction") {
        const [, frac] = value.toString().split(".")

        if (frac !== e.value) {
          isTrimmed = true
        }
      }

      return e.value
    })

    if (isTrimmed) return [`~`, ...parts].join("")

    return parts.join("")
  }
}

export const formatter = Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
})

export const truncateNum = approximateFraction(formatter)
