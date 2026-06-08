import {
  Button,
  EmptyState,
  EmptyStateConceal,
  EmptyStateContent,
  IconButton,
  Modal,
  ScrollAwareSeparator,
  SearchInput,
  TokenSelectionItem,
} from "@hyperbridge/ui"
import { XIcon } from "@hyperbridge/ui/icons"
import { Slot } from "@radix-ui/react-slot"
import { runInAction } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { assetManager } from "@/config/services/asset-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { BalanceImpl } from "@/lib/factories/balance"
import { FiatImpl } from "@/lib/factories/fiat"
import { safeNetworkConfig } from "@/lib/utils"
import {
  currencyFormatter,
  shortenAccountAddress,
} from "@/lib/utils/formatting"
import { flow, O, pipe } from "@/lib/utils/fp.helpers"
import { tokenSelectorStore } from "@/stores/select-token"
import type { AnyToken, ChainId } from "@/types"
import { Value } from "@/components/exchange-value"
import { AddToWalletButtonAction } from "@app/components/integrated/token"
import { TokenValue } from "@/components/integrated/values"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DebugClick } from "@/components/utils/debug-click"
import If from "@/components/utils/if"

type SelectTokenProps = {
  sourceChain: ChainId
  destChain: ChainId
  value: AnyToken
  onChange: (token: AnyToken) => void
}

const tokens = Array.from(tokenRegistry.uniqueTokens())

const safeReadBalance = (source_chain: ChainId, token: AnyToken) => {
  return pipe(
    safeNetworkConfig(source_chain),
    O.flatMap((network) => {
      return assetManager.getBalance({ network, token: token })
    }),
  )
}

export const SelectTokenModal = observer(function SelectTokenModal(
  props: SelectTokenProps,
) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [searchStr, setSearchStr] = React.useState("")

  const nameFilter = (token: AnyToken) => {
    return token.name.toLowerCase().includes(searchStr.toLowerCase())
  }

  const symbolFilter = (token: AnyToken) => {
    return token.symbol.toLowerCase().includes(searchStr.toLowerCase())
  }

  const all_filters = [nameFilter, symbolFilter]
  const filtered_tokens = tokens
    .filter((token) => all_filters.some((fn) => fn(token)))
    .filter((token) =>
      tokenRegistry.isTransferable({
        strict: false,
        source: props.sourceChain,
        destination: props.destChain,
        token_symbol: token.symbol,
      }),
    )
    .map((token) => ({
      token,
      source_token: tokenRegistry.getBySymbol(props.sourceChain, token.symbol),
    }))

  const isEmpty = filtered_tokens.length === 0

  const renderItem = (item: (typeof filtered_tokens)[0]) => {
    const { token: asset } = item
    const is_selected = asset.symbol === props.value?.symbol

    const FALLBACK = {
      source_token_balance: BalanceImpl.empty(),
      fiat_balance: FiatImpl.empty,
    }

    const { source_token_balance, fiat_balance } = O.gen(function* () {
      if (!item.source_token) return FALLBACK

      const { balance, fiatBalance } = yield* safeReadBalance(
        props.sourceChain,
        item.source_token,
      )

      return yield* pipe(
        O.all({ balance, fiatBalance }),
        O.map(({ balance, fiatBalance }) => ({
          source_token_balance: balance,
          fiat_balance: fiatBalance,
        })),
      )
    }).pipe(O.getOrElse(() => FALLBACK))

    const has_amount = !BalanceImpl.isNone(source_token_balance)

    const handleClick = () => {
      props.onChange?.(asset)
      runInAction(() => {
        tokenSelectorStore.state.show = false
      })
      setSearchStr("")
    }

    return (
      <DebugClick
        key={`${item.token.symbol}/${item.token.decimals}/${item.token.address || item.token.assetId}`}
        input={() => ({
          is_selected,
          has_amount,
          token_balance: source_token_balance,
          curr: asset,
          selected: props.value,
        })}
      >
        <li
          className="relative block"
          onClick={handleClick}
          onKeyDown={handleClick}
        >
          <TokenSelectionItem
            token={{
              symbol: asset.symbol,
              name: asset.name,
              image: asset.logo,
              address: shortenAccountAddress(String(asset.address)),
              amount: (
                <If cond={has_amount}>
                  <TokenValue data={source_token_balance} />
                </If>
              ),
              secondaryAmount: (
                <If cond={has_amount}>
                  <Value
                    data={fiat_balance}
                    formatter={currencyFormatter}
                    minisculeValueFallback={"0.00"}
                  />
                </If>
              ),
            }}
            isActive={is_selected}
            isAvailable={true}
            AddWalletButton={
              <AddToWalletButtonAction
                asChild
                network={props.sourceChain}
                asset={asset}
              >
                <Button variant="message" size="sm">
                  <span className="text-caption font-medium">
                    Add to wallet
                  </span>
                </Button>
              </AddToWalletButtonAction>
            }
          />
        </li>
      </DebugClick>
    )
  }

  return (
    <Modal
      isOpen={tokenSelectorStore.state.show}
      onClose={() => {
        tokenSelectorStore.state.show = false
      }}
    >
      <div
        className={
          "bg-brand-black-550 px-6 pb-4 pt-6 transition-all duration-200"
        }
      >
        <div className="flex items-center justify-between">
          <div className="body-1 max-w-[200px] break-words font-medium text-white">
            Select Token
          </div>

          <SelectTokenTrigger>
            <IconButton
              size="xs"
              variant={"unset"}
              className="text-brand-black-100 hover:text-white"
            >
              <XIcon />
            </IconButton>
          </SelectTokenTrigger>
        </div>

        <div className="mt-4">
          <SearchInput
            className="h-10"
            placeholder="Search for token"
            value={searchStr}
            onChange={(e) => setSearchStr(e.target.value)}
          />
        </div>
      </div>

      <EmptyState isEmpty={isEmpty}>
        <EmptyStateConceal>
          <ScrollAwareSeparator scrollRef={scrollRef} />
          <ScrollArea ref={scrollRef} className="h-[80%]">
            <div className="flex flex-col space-y-2 px-6 pb-6">
              {filtered_tokens
                .sort((a, b) => {
                  const readBalance = flow(
                    safeReadBalance,
                    O.flatMap((e) => e.balance),
                    O.getOrElse(() => BalanceImpl.empty()),
                  )

                  return BalanceImpl.orderByValue(
                    readBalance(props.sourceChain, b.token),
                    readBalance(props.sourceChain, a.token),
                  )
                })
                .map(renderItem)}
            </div>
          </ScrollArea>
        </EmptyStateConceal>

        <EmptyStateContent>
          <div className="flex h-full items-center justify-center py-8 text-center">
            <div>
              <p className="body-2 text-brand-black-100 mb-1">
                No tokens available
              </p>
              <p className="text-caption text-brand-black-100">
                Tokens will appear here when available
              </p>
            </div>
          </div>
        </EmptyStateContent>
      </EmptyState>
    </Modal>
  )
})

export function SelectTokenTrigger(props: { children: React.ReactNode }) {
  return (
    <Slot
      onClick={() => {
        runInAction(() => {
          tokenSelectorStore.state.show = !tokenSelectorStore.state.show
        })
      }}
    >
      {props.children}
    </Slot>
  )
}
