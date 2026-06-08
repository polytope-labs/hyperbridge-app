const USER_REJECTED_PATTERNS = [
  /user rejected/i,
  /user denied/i,
  /rejected the request/i,
  /request rejected/i,
  /cancelled/i,
  /details: cancelled/i,
]

export function isUserRejectedError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    // @ts-expect-error viem/wagmi error name
    if (error?.name === "UserRejectedRequestError") return true
  }
  const raw = _getRawErrorMessage(error)
  return USER_REJECTED_PATTERNS.some((p) => p.test(raw))
}

export function getErrorMessage(error: unknown): string {
  if (isUserRejectedError(error)) return "Rejected by user"
  return toComprehensiveMessage(_getRawErrorMessage(error))
}

function _getRawErrorMessage(error: unknown): string {
  if (typeof error === "string") return error

  // @ts-expect-error nested cause message
  const nestedCauseMessage = error?.cause?.message
  if (nestedCauseMessage) return nestedCauseMessage

  // @ts-expect-error viem shortMessage lives on cause
  const shortMessage = error?.cause?.shortMessage
  if (shortMessage) return shortMessage

  // @ts-expect-error direct shortMessage
  const directShort = error?.shortMessage
  if (directShort) return directShort

  // @ts-expect-error description field
  const desc = error?.description
  if (desc) return desc

  // @ts-expect-error details field
  const details = error?.details
  if (details) return details

  // @ts-expect-error direct message field
  const message = error?.message
  if (message) return message

  return String(error)
}

const comprehensiveMessageMap = new Map([
  [/"getAmountsin"\sreverted/i, "Insufficient balance to pay protocool fees"],
])

export function toComprehensiveMessage(message: string) {
  const pairs = Array.from(comprehensiveMessageMap)

  for (const [regex, value] of pairs) {
    if (regex.test(message)) {
      return value
    }
  }

  return message
}
