export function shortenAccountAddress(address: string, length = 6) {
  return `${address.substring(0, length)}...${address.substring(
    address.length - length,
  )}`
}

export const balanceTokenValueFormatter = new Intl.NumberFormat(undefined, {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
  roundingMode: "floor",
})

export const tokenValueFormatter = new Intl.NumberFormat(undefined, {
  style: "decimal",
  maximumFractionDigits: 6,
  roundingMode: "halfTrunc",
})

export const balancePreviewFormatter = new Intl.NumberFormat(undefined, {
  style: "decimal",
  roundingPriority: "lessPrecision",
  maximumFractionDigits: 4,
  roundingMode: "floor",
})

export const shortValueFormatter = new Intl.NumberFormat(undefined, {
  roundingMode: "floor",
  maximumFractionDigits: 2,
})

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  roundingMode: "floor",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  roundingMode: "floor",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const shortTokenValueFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 6,
  roundingMode: "floor",
})

export const enteredAmountFormatter = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
  roundingMode: "floor",
})

export const integerFormatter = new Intl.NumberFormat(undefined, {
  style: "decimal",
  maximumFractionDigits: 0,
})
