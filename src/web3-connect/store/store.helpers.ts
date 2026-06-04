import type { Account, WalletProviderStatus } from "@/types"

/**
 * Ensures that the selected account's address or provider matches at least one of the accounts in the provided list.
 *
 * @param {Account | null} selectedAccount - The account selected to be checked for a match.
 * @param {(Account | null)[]} selectedAccounts - The list of accounts to check against the selected account.
 * @return {boolean} - Returns true if there is a match for the selected account in the list; otherwise, false.
 */
export function ensureSelectedAccountAddrAndProviderMatch(
  selectedAccounts: (Account | null)[],
  selectedAccount: Account,
): boolean {
  if (!selectedAccount) return false

  return selectedAccounts.some((account) => {
    return ensureProviderAndAddrMatch(account, selectedAccount)
  })

  function ensureProviderAndAddrMatch(
    account: Account | null,
    selectedAccount: Account,
  ) {
    if (!account) return false

    return (
      account.address === selectedAccount.address &&
      account.provider === selectedAccount.provider
    )
  }
}

export interface SortableAccount extends Account {
  balance: string
  connectionStatus: WalletProviderStatus
}

export function sortWalletAccounts(params: {
  allAccounts: SortableAccount[]
  activeAccounts: Account[]
}) {
  const sortByActive = sortByAddress(params.activeAccounts)
  return [...params.allAccounts].sort(
    (a: SortableAccount, b: SortableAccount) => {
      return (
        sortByBalance(a, b) + sortByActive(a, b) + sortByConnectionStatus(a, b)
      )
    },
  )
}

export function sortByBalance(a: { balance: string }, b: { balance: string }) {
  if (!a.balance || !b.balance) return 0

  const aBalance = BigInt(a.balance)
  const bBalance = BigInt(b.balance)

  if (aBalance === bBalance) return 0

  return aBalance > bBalance ? 1 : -1
}

function sortByAddress(activeAccounts: Account[]) {
  return function sortByAddressPartial(a: Account, b: Account) {
    if (ensureSelectedAccountAddrAndProviderMatch(activeAccounts, a)) {
      return -1
    }

    if (ensureSelectedAccountAddrAndProviderMatch(activeAccounts, b)) {
      return 1
    }

    return 0
  }
}

export function sortByConnectionStatus(
  a: Pick<SortableAccount, "connectionStatus">,
  b: Pick<SortableAccount, "connectionStatus">,
) {
  const isConnected = (a: Pick<SortableAccount, "connectionStatus">) =>
    a.connectionStatus === "connected"

  // if both connected or disconnected do nothing
  if (isConnected(a) && isConnected(b)) return 0

  if (isConnected(a) && !isConnected(b)) return -1
  if (!isConnected(a) && isConnected(b)) return 1

  return 0
}
