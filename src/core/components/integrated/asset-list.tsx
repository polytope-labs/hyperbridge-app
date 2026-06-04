import {
  AssetList,
  AssetListItem,
  Button,
  EmptyState,
  EmptyStateConceal,
  EmptyStateContent,
  EmptyStateDescription,
  ListHeading,
} from "@hyperbridge/ui"
import { ArrowUpRight, ChevronBottomDown, Coins } from "@hyperbridge/ui/icons"
import {
  type AnyToken,
  type NetworkConfig,
  shortenAccountAddress,
} from "@hyperbridge-fe/shared"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import { Order } from "effect"
import { reaction, toJS } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { isDevelopment } from "@/config/constants"
import {
  assetManager,
  assetManagerStore,
} from "@/config/services/asset-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { getOverflowSafeAmountFormatter } from "@/lib/data.helpers"
import { BalanceImpl } from "@/lib/factories/balance"
import { cn } from "@/lib/utils"
import {
  balanceTokenValueFormatter,
  compactCurrencyFormatter,
  currencyFormatter,
  shortTokenValueFormatter,
} from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import { SidebarTabs, walletConnectionState } from "@/stores/wallet"
import type { AppBalance, FiatValue } from "@/types"
import { Value } from "../exchange-value"
import { ScrollArea } from "../ui/scroll-area"
import { AutoSizer } from "../ui/scroll-windowing-area"
import { DebugClick } from "../utils/debug-click"
import If from "../utils/if"
import { TokenValue } from "./values"

export function Assets() {
  return (
    <AutoSizer className="flex-1">
      {(dim) => {
        return (
          <div style={{ height: `${dim.height}px` }}>
            <EmptyState isEmpty={tokenRegistry.isEmpty()}>
              <EmptyStateConceal>
                <ScrollArea className="-mx-4 h-full">
                  <div className="flex flex-col gap-[1.5rem] px-4 pb-8">
                    <AvailableAssetList />
                    <HiddenAssetList />
                  </div>
                </ScrollArea>
              </EmptyStateConceal>

              <TokenEmptyState />
            </EmptyState>
          </div>
        )
      }}
    </AutoSizer>
  )
}

function TokenEmptyState() {
  return (
    <EmptyStateContent className="text-foreground-muted flex flex-1 flex-col justify-center">
      <Coins width="1.5rem" height="1.5rem" />
      <EmptyStateDescription>
        You have no tokens to display yet
      </EmptyStateDescription>
    </EmptyStateContent>
  )
}

const AvailableAssetList = observer(function AvailableAssetList() {
  const availableTokens = assetManagerStore.tokensWithFunds

  React.useEffect(function refreshWhenTabActive() {
    return reaction(
      () => walletConnectionState.lastViewedTab,
      (tab) => {
        if (tab === SidebarTabs.assets) {
          assetManager.refreshBalances({})
        }
      },
      { fireImmediately: true },
    )
  }, [])

  return (
    <AssetList>
      <EmptyState isEmpty={availableTokens.length === 0}>
        <TokenEmptyState />
        <EmptyStateConceal>
          {availableTokens
            .sort((a, b) => Order.string(a.token.name, b.token.name))
            .map((asset) => {
              const { network, token, balance, fiatBalance } = asset
              const key = `available-token-${token.symbol}-${network.chainId}-${token.assetId ?? token.address}`

              return (
                <AssetListItemIntegrated
                  key={key}
                  token={token}
                  network={network}
                  balance={balance}
                  secondaryBalance={fiatBalance}
                />
              )
            })}
        </EmptyStateConceal>
      </EmptyState>
    </AssetList>
  )
})

const HiddenAssetList = observer(function HiddenAssetList() {
  const [show, setShow] = React.useState(false)
  const hidden_assets = assetManagerStore.tokensWithoutFunds

  return (
    <div className="space-y-3">
      <div className="bg-brand-black-550 sticky inset-x-0 top-px z-50 flex items-center py-2">
        <ListHeading count={hidden_assets.length} text={"Hidden"} />

        <Button
          variant="ghost"
          size="xs"
          className="absolute end-0"
          onClick={() => setShow((s) => !s)}
        >
          <span>{show ? "Hide" : "Show"}</span>
          <ChevronBottomDown
            data-expand={show}
            className={
              "transform transition-all duration-200 data-[expand=true]:rotate-180"
            }
          />
        </Button>
      </div>

      <If cond={show}>
        <AssetList>
          <EmptyState isEmpty={hidden_assets.length === 0}>
            <TokenEmptyState />

            <EmptyStateConceal>
              {hidden_assets.map(({ network, token, balance, fiatBalance }) => {
                const key = `hidden-token-${token.symbol}-${network.chainId}-${token.assetId ?? token.address}`

                return (
                  <AssetListItemIntegrated
                    key={key}
                    token={token}
                    network={network}
                    balance={balance}
                    secondaryBalance={fiatBalance}
                  />
                )
              })}
            </EmptyStateConceal>
          </EmptyState>
        </AssetList>
      </If>
    </div>
  )
})

const AssetListItemIntegrated = observer(
  function AssetListItemIntegrated(props: {
    token: AnyToken
    network: NetworkConfig
    balance: O.Option<AppBalance>
    secondaryBalance: O.Option<FiatValue>
  }) {
    const { token, network, balance, secondaryBalance } = props
    const amountFormatter = balance.pipe(
      O.map((bal) =>
        getOverflowSafeAmountFormatter({
          amount: BalanceImpl.toNumber(bal),
          defaultFormatter: balanceTokenValueFormatter,
          compactFormatter: shortTokenValueFormatter,
        }),
      ),
      O.getOrUndefined,
    )
    const fiatFormatter = secondaryBalance.pipe(
      O.map((bal) =>
        getOverflowSafeAmountFormatter({
          amount: bal.amount,
          defaultFormatter: currencyFormatter,
          compactFormatter: compactCurrencyFormatter,
        }),
      ),
      O.getOrUndefined,
    )

    return (
      <DebugClick
        disabled={!isDevelopment}
        input={() => ({
          balance,
          token: toJS(token),
          network: toJS(network),
          usd_balance: secondaryBalance,
        })}
      >
        <div className="group/asset-item">
          <AssetListItem
            caption={token.name}
            tokenImage={{
              src: token.logo,
              alt: `${token.name} Logo`,
              badgeSrc: network.logo,
              badgeAlt: network.name,
            }}
            amount={balance.pipe(
              O.map((bal) => (
                <TokenValue
                  key="token-value"
                  symbolView="hide"
                  data={bal}
                  minisculeValueFallback={undefined}
                  formatter={amountFormatter}
                />
              )),
              O.getOrNull,
            )}
            amountInUSD={secondaryBalance.pipe(
              O.map((bal) => (
                <Value
                  key="secondary-value"
                  data={bal}
                  formatter={fiatFormatter}
                  minisculeValueFallback={undefined}
                  symbolView="hide"
                />
              )),
              O.getOrElse(() => <span className="tabular-nums">{"$0.0"}</span>),
            )}
            address={TokenImpl.match<React.ReactNode>(token, {
              evm: (token) => {
                const url = TokenImpl.addressUrl(token, network)

                if (!url) return null

                return (
                  <ExternalLink
                    href={url}
                    title="Verify Contract Address"
                    className="opacity-0 group-hover/asset-item:opacity-100"
                  >
                    {shortenAccountAddress(token.address)}
                  </ExternalLink>
                )
              },
              _: () => "",
            })}
          />
        </div>
      </DebugClick>
    )
  },
)

function ExternalLink(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      rel="noopener noreferrer"
      target="_blank"
      className={cn(
        "hover:text-brand-white-500 group inline-flex cursor-pointer items-center gap-0.5",
        props.className,
      )}
    >
      <span>{props.children}</span>
      <ArrowUpRight className="-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </a>
  )
}
