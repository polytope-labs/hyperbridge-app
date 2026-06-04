import {
  Button,
  EmptyState,
  EmptyStateConceal,
  EmptyStateContent,
  IconButton,
  Modal,
  NetworkSelectionItem,
  NetworkSwitcher,
  ScrollAwareSeparator,
  SearchInput,
} from "@hyperbridge/ui"
import { XIcon } from "@hyperbridge/ui/icons"
import { resolveNetworkGroup } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { AnyToken, NetworkConfig } from "@hyperbridge-fe/shared/types"
import capitalize from "lodash-es/capitalize"
import groupBy from "lodash-es/groupBy"
import { observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { getNetworkConfig } from "@/lib/utils"
import { WalletManager } from "@/lib/wallet-manager"
import type { ChainId } from "@/types"
import { HyperBridgeConnectWallet } from "@/components/wallets/wallet-button"

type NetworkSelectorStore = {
  show: boolean
  field: "source" | "destination"
}

const store = observable<NetworkSelectorStore>({
  show: false,
  field: "source",
})

export function NetworkDirectionSwitcher(props: {
  source: ChainId
  destination: ChainId
  onSwitch: (values: { source: ChainId; destination: ChainId }) => void
}) {
  const { source, destination } = props

  const [sourceNetwork, destinationNetwork] = React.useMemo(
    () => [source, destination].map((e) => getNetworkConfig(e)),
    [source, destination],
  )

  return (
    <NetworkSwitcher
      from={{
        image: sourceNetwork?.logo ?? "?",
        name: sourceNetwork?.name ?? "?",
      }}
      to={{
        image: destinationNetwork?.logo ?? "?",
        name: destinationNetwork?.name ?? "?",
      }}
      onNetworkInvert={() => {
        props.onSwitch({
          source: props.destination,
          destination: props.source,
        })
      }}
      onSourceClick={() => {
        runInAction(() => {
          store.show = true
          store.field = "source"
        })
      }}
      onDestinationClick={() => {
        runInAction(() => {
          store.show = true
          store.field = "destination"
        })
      }}
    />
  )
}

export const NetworkModal = observer(function NetworkModal(props: {
  source: ChainId
  destination: ChainId
  token: AnyToken
  filter?: (network: ChainId, store: { isSourceChain: boolean }) => boolean
  onNetworkChange: (values: { source: ChainId; destination: ChainId }) => void
}) {
  const { onNetworkChange, filter } = props
  const is_viewing_source = store.field === "source"

  const networks = gatewayConfig.bridgeableNetworks.get()
  const [searchStr, setSearchStr] = React.useState("")

  const { supported = [], unsupported = [] } = React.useMemo(() => {
    const name_filter = (network: NetworkConfig) => {
      return network.name.toLowerCase().includes(searchStr.toLowerCase())
    }

    const network_filter = filter
      ? (network: NetworkConfig) =>
          filter(network.chainId, { isSourceChain: is_viewing_source })
      : () => true

    const ignore_source_network = (network: NetworkConfig) => {
      if (!is_viewing_source && props.source === network.chainId) {
        return false
      }

      return true
    }

    const all_filters = [network_filter, name_filter, ignore_source_network]

    return groupBy(
      networks.filter((network) => all_filters.every((fn) => fn(network))),
      (network) => {
        if (network.chainId === props.source) return "supported"
        if (is_viewing_source) return "supported"

        return tokenRegistry.isTransferable({
          strict: false,
          source: props.source,
          destination: network.chainId,
          token_symbol: props.token.symbol,
        })
          ? "supported"
          : "unsupported"
      },
    )
  }, [
    filter,
    networks,
    searchStr,
    is_viewing_source,
    props.source,
    props.token.symbol,
  ])

  const scrollableRef = React.useRef<HTMLDivElement>(null)

  const isEmpty = supported.length === 0 && unsupported.length === 0
  const hasNoResults = Boolean(searchStr.trim()) && isEmpty

  const renderItem = React.useCallback(
    (network: NetworkConfig) => {
      const network_group = resolveNetworkGroup(network.chainId)
      const wallet_is_connected = WalletManager.accounts[network_group] !== null
      const is_selected = props[store.field] === network.chainId
      const is_disabled = !NetworkImpl.is_enabled(network)

      return (
        <NetworkSelectorItem
          key={network.chainId}
          isWalletConnected={is_viewing_source ? wallet_is_connected : true}
          isSelected={is_selected}
          isDisabled={is_disabled}
          network={network}
          onClick={() => {
            const values = transformBeforeChange(props, {
              chainId: network.chainId,
              field: store.field,
            })
            onNetworkChange?.(values)
            setSearchStr("")
            runInAction(() => {
              store.show = false
            })
          }}
        />
      )
    },
    [onNetworkChange, props, is_viewing_source],
  )

  return (
    <Modal
      isOpen={store.show}
      onClose={() => {
        runInAction(() => {
          store.show = false
        })
      }}
    >
      <div
        className={
          "bg-brand-black-550 px-6 pb-4 pt-6 transition-all duration-200"
        }
      >
        <div className="flex items-center justify-between">
          <div className="body-1 max-w-[200px] break-words font-medium text-white">
            Select {capitalize(store.field)} chain
          </div>

          <IconButton
            size="xs"
            onClick={() => {
              store.show = false
            }}
            variant={"unset"}
            className="text-brand-black-100 hover:text-white"
          >
            <XIcon />
          </IconButton>
        </div>

        <div className="mt-4">
          <SearchInput
            className="h-10 !text-base"
            placeholder="Search for chain"
            value={searchStr}
            onChange={(e) => setSearchStr(e.target.value)}
          />
        </div>
      </div>

      <ScrollAwareSeparator
        scrollRef={scrollableRef}
        className="data-[active=true]:border-brand-black-300/70 data-[active=false]:border-brand-black-300/0"
      />

      <EmptyState isEmpty={hasNoResults}>
        <EmptyStateConceal>
          <div
            ref={scrollableRef}
            className="no-scrollbar h-full space-y-4 overflow-y-auto px-6 pb-6"
          >
            {/* Available Networks */}
            {supported.length > 0 && (
              <div>
                <p className="text-caption text-brand-black-100">Available</p>
                <div className="mt-[6px] space-y-2">
                  {supported.map((network) => renderItem(network))}
                </div>
              </div>
            )}

            {/* Unavailable Networks */}
            {unsupported.length > 0 && (
              <div>
                <p className="text-caption text-brand-black-100">
                  Not available
                </p>
                <div className="mt-[6px] space-y-2">
                  {unsupported.map((network) => renderItem(network))}
                </div>
              </div>
            )}

            {/* No results */}
            {hasNoResults && (
              <div className="flex h-full items-center justify-center py-8 text-center">
                <p className="text-caption text-brand-black-100">
                  No results found for{" "}
                  <span className="font-medium text-white">{searchStr}</span>
                </p>
              </div>
            )}
          </div>
        </EmptyStateConceal>

        <EmptyStateContent className="flex h-full items-center justify-center py-8 text-center">
          <div>
            <p className="body-2 text-brand-black-100 mb-1">
              No networks available
            </p>
            <p className="text-caption text-brand-black-100">
              Networks will appear here when available
            </p>
          </div>
        </EmptyStateContent>
      </EmptyState>
    </Modal>
  )
})

function NetworkSelectorItem(props: {
  network: NetworkConfig
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
  isWalletConnected?: boolean
}) {
  const Providers = {
    evm: "Ethereum",
    substrate: "Polkadot",
  } as const

  const {
    network,
    isWalletConnected = false,
    isSelected: is_selected,
    isDisabled,
  } = props
  const network_group = resolveNetworkGroup(network.chainId)
  const is_network_disabled = !NetworkImpl.is_enabled(network)
  const is_disconnected = is_network_disabled ? false : !isWalletConnected
  const variant = is_network_disabled
    ? "secondary"
    : is_disconnected
      ? "secondary"
      : "default"

  return (
    <NetworkSelectionItem
      network={{
        name: network.name,
        image: network.logo,
        group: Providers[network_group] ?? "Unknown",
      }}
      variant={variant}
      disabled={is_network_disabled || isDisabled}
      isActive={is_selected}
      onClick={props.onClick}
      SecondaryContent={
        is_network_disabled ? (
          <span className="text-caption text-brand-black-100 pr-2 font-medium">
            Under maintenance
          </span>
        ) : (
          <HyperBridgeConnectWallet
            network={resolveNetworkGroup(network.group)}
          >
            <Button
              variant="message"
              size="sm"
              className="md:opacity-1 group-hover:opacity-100"
              onClick={(evt) => {
                evt.stopPropagation()
              }}
            >
              <span className="text-caption font-medium">Connect</span>
            </Button>
          </HyperBridgeConnectWallet>
        )
      }
    />
  )
}

function transformBeforeChange(
  prev: {
    source: ChainId
    destination: ChainId
  },
  next: { field: "source" | "destination"; chainId: ChainId },
) {
  const current_field = next.field
  const opposite_field = current_field === "source" ? "destination" : "source"

  const is_currently_selected = [prev.source, prev.destination].some(
    (chain_id) => chain_id === next.chainId,
  )

  // invert if network is currently selected for either source or destination
  if (is_currently_selected) {
    const prev_clone = { ...prev }
    prev_clone[current_field] = next.chainId
    prev_clone[opposite_field] = prev[current_field]

    return prev_clone
  }

  return { ...prev, [next.field]: next.chainId }
}
