import { avataaars } from "@dicebear/collection"
import { createAvatar } from "@dicebear/core"
import {
  Ethereum,
  type NetworkTagSimple,
  Polkadot,
} from "@hyperbridge-fe/shared"
import { isEvmAddress, safeDict } from "@hyperbridge-fe/shared/lib"
import {
  type WalletProvider,
  WalletProviderStatus,
} from "@hyperbridge-fe/web3-connect"
import {
  EVM_PROVIDERS,
  isDesktopOnlyProvider,
  isMobileOnlyProvider,
  type WalletProviderType,
} from "@hyperbridge-fe/web3-connect/constants"
import { resolveNetworkGroupByProvider } from "@hyperbridge-fe/web3-connect/helpers"
import { getSupportedWallets } from "@hyperbridge-fe/web3-connect/wallets"
import { computed } from "mobx"
import { safeArray } from "@/lib/data.helpers"
import { copyToClipboard } from "@/lib/utils/clipboard"
import { toast } from "@/lib/utils/toast"
import { WalletManager } from "@/lib/wallet-manager"
import type { HBUIAccount } from "@/types/network-types"
import type { HexString } from "@/types/tx"

export const getSelectedAccounts = computed((): HBUIAccount[] => {
  return WalletManager.connectedAccounts
    .filter((e) => !!e)
    .map((account) => {
      const provider = WalletManager.getProviderByType(account.provider)
      const isEvm = isEvmAddress(account.address)
      const network = isEvm ? Ethereum : Polkadot

      return {
        address: account.address as HexString,
        displayAddress: account.address,
        provider: account.provider,
        name: account.name,
        wallet: {
          name: provider?.wallet?.title || account.name || "Unknown",
          image: provider?.wallet?.logo.src || "",
        },
        network: {
          name: network.name,
          image: network.logo,
        },
      }
    })
})

/**
 * Copy account address to clipboard with toast feedback
 */
export const handleCopyAddress = async (address: string) => {
  await copyToClipboard(address)
  toast.success("Address copied to clipboard", {
    heading: "Success",
  })
}

type UIWalletStatus = "connecting" | "connected" | "failed" | "idle"

const WalletUIStatusMap = safeDict<Record<string, UIWalletStatus>>({
  map: {
    connected: "connected",
    pending: "connecting",
    error: "failed",
  },
  default: "idle",
})

export const getUIWalletStatus = (provider: WalletProvider): UIWalletStatus => {
  const status = WalletManager.getStatus(provider.type)

  return WalletUIStatusMap.strict(status)
}

export const handleWalletCancel = (provider: WalletProvider) => {
  WalletManager.setStatus(provider.type, WalletProviderStatus.Disconnected)
}

/**
 * Get Network compatible wallets based on the selected network (EVM | Polkadot).
 */
export const getNetworkCompatibleWallets = ({
  network_group: selectedNetwork,
}: {
  network_group: NetworkTagSimple | null
}) => {
  if (!selectedNetwork) return []

  const allProviders = getSupportedWallets()

  return allProviders.filter((provider) => {
    const providerNetworkGroup = resolveNetworkGroupByProvider(provider.type)
    return providerNetworkGroup === selectedNetwork
  })
}

/**
 * Categorize wallet providers into different sections based on platform compatibility and install status
 */
export const categorizeWallets = (
  providers: WalletProvider[],
  platform: "desktop" | "mobile" = "desktop",
  installedWalletTypes?: Set<WalletProviderType>,
) => {
  const isCurrentPlatformMobile = platform === "mobile"

  const evmInstalledTypes =
    installedWalletTypes ??
    WalletManager.wagmiExtension.getInstalledProviderTypes()

  const categorized = Object.groupBy(providers, (provider) => {
    const isMobileOnly = isMobileOnlyProvider(provider.type)
    const isDesktopOnly = isDesktopOnlyProvider(provider.type)

    const isUnsupported =
      (isCurrentPlatformMobile && isDesktopOnly) ||
      (!isCurrentPlatformMobile && isMobileOnly)

    if (isUnsupported) {
      return "unsupported"
    }

    const isEvm = EVM_PROVIDERS.includes(provider.type)
    let isInstalled: boolean

    if (isEvm) {
      isInstalled = evmInstalledTypes.has(provider.type)
    } else {
      isInstalled = WalletManager.installedProviders.some(
        (p) => p.type === provider.type,
      )
    }

    return isInstalled ? "installed" : "notInstalled"
  })

  return {
    installedWallets: safeArray(categorized.installed),
    notInstalledWallets: safeArray(categorized.notInstalled),
    unsupportedWallets: safeArray(categorized.unsupported),
  }
}

/**
 * Get the unsupported message for a wallet provider
 */
export const getUnsupportedMessage = (
  providerType: WalletProviderType,
): string => {
  if (isMobileOnlyProvider(providerType)) {
    return "Available on mobile only"
  }
  if (isDesktopOnlyProvider(providerType)) {
    return "Available on desktop only"
  }
  return "Not supported on this platform"
}

export const getAvatarUrl = (address: string): string => {
  const avatar = createAvatar(avataaars, {
    seed: address,
    size: 32,
  })
  return avatar.toDataUri()
}
