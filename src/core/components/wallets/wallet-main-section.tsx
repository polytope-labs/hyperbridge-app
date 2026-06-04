import {
  Balance,
  SearchInput,
  TabItem,
  Tabs,
  TabsContent,
  TabsList,
} from "@hyperbridge/ui"
import { observer } from "mobx-react"
import React from "react"
import { assetManagerStore } from "@/config/services/asset-manager.ts"
import { getOverflowSafeAmountFormatter } from "@/lib/data.helpers"
import {
  compactCurrencyFormatter,
  currencyFormatter,
} from "@/lib/utils/formatting"
import {
  activeSearchActions,
  activeSearchState,
  historySearchActions,
  historySearchState,
} from "@/stores/history"
import { SidebarTabs, walletConnectionState } from "@/stores/wallet"
import { Assets } from "../integrated/asset-list"
import { ActiveTxs, TxHistory } from "../transaction/integrated/history"

export const WalletMainContent = observer(function WalletMainContent() {
  return (
    <Tabs
      className="flex-1 gap-0"
      value={walletConnectionState.lastViewedTab}
      onValueChange={(value) => {
        walletConnectionState.lastViewedTab =
          value as (typeof walletConnectionState)["lastViewedTab"]
      }}
    >
      <TabsList>
        <TabItem value={SidebarTabs.assets}>Tokens</TabItem>
        <TabItem value={SidebarTabs.active}>Active</TabItem>
        <TabItem value={SidebarTabs.history}>History</TabItem>
      </TabsList>

      <TabsContent value={SidebarTabs.assets} asChild>
        <div className="mt-[1.5rem] flex flex-1 flex-col gap-[1.5rem]">
          <div className="flex flex-col gap-[0.5rem]">
            <BalanceIntegrated />
            {/*<AssetValueTrend direction="up" dollarValue={0} percentage={0} />*/}
          </div>

          <Assets />
        </div>
      </TabsContent>

      <TabsContent
        value={SidebarTabs.active}
        className="flex flex-1 flex-col gap-[1.5rem] pt-[0.625rem]"
      >
        <SearchInputActive />
        <ActiveTxs />
      </TabsContent>

      <TabsContent
        value={SidebarTabs.history}
        className="flex flex-1 flex-col gap-[1.5rem] pt-[0.625rem]"
      >
        <SearchInputHistory />
        <TxHistory />
      </TabsContent>
    </Tabs>
  )
})

const BalanceIntegrated = observer(function BalanceIntegrated() {
  const balance = assetManagerStore.totalBalance

  const formatter = React.useMemo(() => {
    const defaultFormatter = new Intl.NumberFormat("en-US", {
      ...currencyFormatter.resolvedOptions(),
      style: "decimal",
      maximumFractionDigits: 2,
    })
    const compactFormatter = new Intl.NumberFormat("en-US", {
      ...compactCurrencyFormatter.resolvedOptions(),
      style: "decimal",
      maximumFractionDigits: 2,
    })

    return getOverflowSafeAmountFormatter({
      amount: balance.amount,
      defaultFormatter,
      compactFormatter,
    })
  }, [balance.amount])

  return <Balance prefix="$" amount={balance.amount} formatter={formatter} />
})

const SearchInputActive = observer(function SearchInputActive() {
  return (
    <SearchInput
      size="md"
      placeholder="Search active transactions"
      value={activeSearchState.searchTerm}
      className="h-9!"
      onChange={(e) => {
        activeSearchActions.setSearchTerm(e.target.value)
      }}
    />
  )
})

const SearchInputHistory = observer(function SearchInputHistory() {
  return (
    <SearchInput
      size="md"
      placeholder="Search transaction history"
      value={historySearchState.searchTerm}
      className="h-9!"
      onChange={(e) => {
        historySearchActions.setSearchTerm(e.target.value)
      }}
    />
  )
})
