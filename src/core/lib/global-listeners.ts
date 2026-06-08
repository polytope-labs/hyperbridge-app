import { debounce } from "lodash-es"
import { hash } from "ohash"
import { assetManager } from "@/config/services/asset-manager.ts"
import { type WalletManager, watchAccounts } from "./wallet-manager"

function _makeRefreshBalances() {
  let last_change_hash = ""

  return function handleUpdate(
    new_accounts: (typeof WalletManager)["accounts"],
  ) {
    const address_map = {
      evm: new_accounts.evm?.address,
      evm_provider: new_accounts.evm?.provider,
      substrate: new_accounts.substrate?.address,
      substrate_provider: new_accounts.substrate?.provider,
    }

    const new_hash = hash(address_map)
    const changed = !(last_change_hash === new_hash)

    if (!changed) return

    last_change_hash = new_hash
    assetManager.store.resetBalances()
  }
}

export const refreshBalances = debounce(_makeRefreshBalances(), 5000, {
  leading: true,
})

// refresh balances on account change
function refreshBalancesOnAccountChange() {
  return watchAccounts({
    onChange: refreshBalances,
  })
}

refreshBalancesOnAccountChange()
