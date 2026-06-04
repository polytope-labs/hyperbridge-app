/**
 * Web3 Connect Hooks
 * Reusable hooks for wallet connection state management
 */
import {
  type MutationObserverOptions,
  type QueryObserverOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import { useEffect } from "react"
import type { WalletProviderType } from "@/constants"
import type { NamespaceType } from "@/helpers/namespace"
import {
  isEvmProvider,
  resolveNetworkGroupByProvider,
} from "../helpers/wallet-helpers"
import { PolkadotSigner } from "@/signer"
import { EthereumSigner } from "@/signer/EthereumSigner"
import { walletManager } from "@/store/wallet-manager-registry"
import type {
  Account,
  EIP6963AnnounceProviderEvent,
  WalletAccount,
  WalletMode,
} from "@/types"
import { handleAnnounceProvider, normalizeProviderType } from "@/wallets"
import { ExternalWallet } from "@/wallets/ExternalWallet"
import { SubWallet } from "@/wallets/SubWallet"
import { Talisman } from "@/wallets/Talisman"
import consola from "consola"

/**
 * From Hydration
 */
export const useAnnounceProviders = () => {
  useEffect(() => {
    const announceProvider = (e: unknown) =>
      handleAnnounceProvider(e as EIP6963AnnounceProviderEvent)

    window.addEventListener("eip6963:announceProvider", announceProvider)
    window.dispatchEvent(new Event("eip6963:requestProvider"))

    return () => {
      window.removeEventListener("eip6963:announceProvider", announceProvider)
    }
  }, [])
}

export const useWalletAccounts = (
  type?: WalletProviderType | null,
  options?: QueryObserverOptions<WalletAccount[], unknown, Account[]>,
) => {
  const wallet_manager = walletManager()

  const connectedProviders = wallet_manager.connectedProviders
  const isEmpty = connectedProviders.length === 0

  const QUERY_KEYS = {
    providerAccounts: (provider: string | undefined) => [
      "web3Accounts",
      provider,
    ],
  } as const

  const queryKey = QUERY_KEYS.providerAccounts(
    connectedProviders
      .map(({ type }) => getProviderQueryKey(type, wallet_manager.mode))
      .join("-"),
  )

  const query = useQuery<WalletAccount[], unknown, Account[]>({
    enabled: !isEmpty,
    queryKey: queryKey,
    queryFn: async () => {
      const readAccounts = wallet_manager.connectedProviders.map(
        async ({ wallet, type }) => {
          if (!wallet) return []

          // Skip EVM wallets - they're handled by Wagmi watchers
          if (isEvmProvider(type)) {
            return []
          }

          try {
            return await wallet.getAccounts()
          } catch (err) {
            consola.error("APP_ERROR: Error fetching accounts", err)
            return []
          }
        },
      )

      return (await Promise.all(readAccounts)).flat()
    },
    select: (data) => {
      if (!data) return []
      if (type) {
        return data
          .map(mapWalletAccount)
          .filter(({ provider }) => provider === type)
      }
      return data.map(mapWalletAccount)
    },
    gcTime: 0,
    staleTime: 5000,
    placeholderData: (prev) => (isEmpty ? [] : prev),
    ...options,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only needed to run once
  useEffect(function refetchOnFocus() {
    const controller = new AbortController()

    window.addEventListener("focus", () => query.refetch(), {
      signal: controller.signal,
    })

    return () => controller.abort()
  }, [])

  return query
}

function getProviderQueryKey(
  type: WalletProviderType | null,
  mode: WalletMode,
) {
  const { wallet } = walletManager().getProviderByType(type)

  if (wallet?.signer instanceof PolkadotSigner) {
    return [type, wallet.signer?.session?.topic].filter(Boolean).join("-")
  }

  if (wallet?.signer instanceof EthereumSigner) {
    return [type, wallet.signer?.address].filter(Boolean).join("-")
  }

  if (wallet instanceof ExternalWallet) {
    return [type, wallet.account?.address].filter(Boolean).join("-")
  }

  if (wallet instanceof SubWallet || wallet instanceof Talisman) {
    return [type, mode].filter(Boolean).join("-")
  }

  return type ?? ""
}

function mapWalletAccount({
  address,
  name,
  wallet,
  genesisHash,
}: WalletAccount) {
  const providerType: WalletProviderType = wallet
    ? normalizeProviderType(wallet)
    : ("" as WalletProviderType)

  return {
    address,
    displayAddress: address,
    genesisHash,
    name: name ?? "",
    provider: providerType,
    isExternalWalletConnected: wallet instanceof ExternalWallet,
  }
}

export const useEnableWallet = (
  provider: WalletProviderType | null,
  options?: MutationObserverOptions<
    WalletAccount[] | undefined,
    unknown,
    NamespaceType | undefined,
    unknown
  >,
) => {
  const { mutate: enable, ...mutation } = useMutation<
    WalletAccount[] | undefined,
    unknown,
    NamespaceType | undefined,
    unknown
  >({
    mutationFn: async (namespace) => {
      const wallet_manager = walletManager()

      const { wallet } = wallet_manager.getProviderByType(provider)

      if (!wallet) return []

      // ensure only one EVM wallet is connected at a time
      if (isEvmProvider(provider)) {
        const connectedEVMProviders = wallet_manager.connectedProviders.filter(
          (e) => resolveNetworkGroupByProvider(e.type) === "evm",
        )

        for (const provider of connectedEVMProviders) {
          wallet_manager.disconnectProvider(provider.type)
        }
      }

      await wallet_manager.connect({
        wallet,
        chain: wallet_manager.meta?.chain,
        namespace: namespace ?? undefined,
      })

      // For EVM wallets, get account from Wagmi (if available)
      // Note: Account may not be immediately available; watchers will update it
      if (provider && isEvmProvider(provider)) {
        const network = resolveNetworkGroupByProvider(provider)
        const connectedAccount =
          wallet_manager.wagmiExtension.getConnectedAccount(wallet)

        if (connectedAccount) {
          const account: Account = {
            address: connectedAccount.address,
            name: connectedAccount.name,
            provider: provider,
          }

          wallet_manager.setAccount(network, account)

          return [
            {
              address: account.address,
              source: account.provider,
              name: account.name,
              wallet,
            },
          ]
        }

        // Account not immediately available - return empty array
        // Watchers (watchAccount/watchConnections) will update account when ready
        return []
      } else {
        // For substrate wallets, use wallet.getAccounts()
        return await wallet.getAccounts()
      }
    },
    retry: false,
    ...options,
  })

  return {
    enable,
    disconnect: () => walletManager().disconnect(),
    ...mutation,
  }
}
