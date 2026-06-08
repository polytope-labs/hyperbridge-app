import {
  APP_NAME,
  APP_URL,
  WALLET_CONNECT_ID,
} from "@hyperbridge-fe/shared/constants"
import { isEvmAddress, shortenAccountAddress } from "@hyperbridge-fe/shared/lib"
import type { Wallet, WalletAccount } from "@talismn/connect-wallets"
import { WalletConnectModal } from "@walletconnect/modal"
import type { SessionTypes } from "@walletconnect/types"
import UniversalProvider, {
  type IUniversalProvider,
  type NamespaceConfig,
  type UniversalProviderOpts,
} from "@walletconnect/universal-provider"
import { WalletProviderType } from "@/constants"
import { type NamespaceType, namespaces } from "@/helpers/namespace"
import { EthereumSigner, PolkadotSigner } from "@/signer"

const walletConnectParams: UniversalProviderOpts = {
  projectId: WALLET_CONNECT_ID,
  relayUrl: "wss://relay.walletconnect.com",
  metadata: {
    name: APP_NAME,
    description: APP_NAME,
    url: "https://hyperbridge.network/",
    icons: [`${APP_URL}/logo.png`],
  },
}

type ModalSubFn = (param?: SessionTypes.Struct | undefined) => void

export class WalletConnect implements Wallet {
  extensionName: WalletProviderType = WalletProviderType.WalletConnect
  title = "WalletConnect"
  installUrl = ""
  logo = {
    src: "/wallets/wallet-connect.svg",
    alt: "WalletConnect Logo",
  }

  _modal: WalletConnectModal | undefined
  _extension: IUniversalProvider | undefined
  _signer: PolkadotSigner | EthereumSigner | undefined
  _session: SessionTypes.Struct | undefined
  _namespace: NamespaceConfig | undefined
  _instance: IUniversalProvider | undefined

  onSessionDelete: () => void = () => {}

  constructor({
    onModalOpen,
    onModalClose,
    onSessionDelete,
  }: {
    onModalOpen?: ModalSubFn
    onModalClose?: ModalSubFn
    onSessionDelete?: () => void
  } = {}) {
    this._modal = new WalletConnectModal({
      projectId: WALLET_CONNECT_ID,
    })

    this.subscribeToModalEvents(onModalOpen, onModalClose)

    if (onSessionDelete) this.onSessionDelete = onSessionDelete
  }

  getInstance = async () => {
    if (!this._instance) {
      this._instance = await UniversalProvider.init(walletConnectParams)
    }

    return this._instance
  }

  get extension() {
    return this._extension
  }

  get signer() {
    return this._signer
  }

  get modal() {
    return this._modal
  }

  get namespace() {
    return this._namespace
  }

  get installed() {
    return true
  }

  get rawExtension() {
    return this._extension
  }

  initializeProvider = async () => {
    await this._extension?.cleanupPendingPairings()
    await this._extension?.disconnect()

    // Clear stale IndexedDB data on mobile browsers to prevent modal issues
    // This is especially important for mobile where cached sessions can block new connections
    if (typeof window !== "undefined" && "indexedDB" in window) {
      try {
        const dbName = "WALLET_CONNECT_V2_INDEXED_DB"
        const deleteReq = indexedDB.deleteDatabase(dbName)
        await new Promise<void>((resolve) => {
          deleteReq.onsuccess = () => resolve()
          deleteReq.onerror = () => {
            resolve()
          }
          deleteReq.onblocked = () => {
            resolve()
          }
        })
      } catch {
        // Ignore IndexedDB errors - continue with connection attempt
      }
    }

    // Reset instance to force fresh initialization
    this._instance = undefined

    const provider = await this.getInstance()

    if (!provider) {
      throw new Error(
        "WalletConnectError: Connection failed. Please try again.",
      )
    }

    this._extension = provider
    //@ts-expect-error Use to be ts-ignore WC types are not up to date
    provider.on("display_uri", this.handleDisplayUri)
    //@ts-expect-error Use to be ts-ignore WC types are not up to date
    provider.on("session_update", this.handleSessionUpdate)
    //@ts-expect-error Use to be ts-ignore WC types are not up to date
    provider.on("session_delete", this.handleSessionDelete)

    return provider
  }

  transformError = (err: Error): Error => {
    return err
  }

  setNamespace = async (namespace: NamespaceType) => {
    this._namespace = {
      [namespace]: namespaces[namespace],
    }
  }

  getChains = () => {
    if (!this.namespace) return []

    return Object.values(this.namespace).flatMap(
      (namespace) => namespace.chains,
    )
  }

  subscribeToModalEvents = (onOpen?: ModalSubFn, onClose?: ModalSubFn) => {
    this.modal?.subscribeModal((state) => {
      if (state.open) {
        onOpen?.()
      } else {
        onClose?.(this._session)

        if (!this._session) {
          this.disconnect()
        }
      }
    })
  }

  handleDisplayUri = async (uri: string) => {
    if (!this.modal) {
      this._modal = new WalletConnectModal({
        projectId: WALLET_CONNECT_ID,
      })
    }
    await this.modal?.openModal({ uri, chains: this.getChains() })
  }

  handleSessionUpdate = ({ session }: { session: SessionTypes.Struct }) => {
    this._session = session
  }

  handleSessionDelete = () => {
    this.disconnect()
    this.onSessionDelete()
  }

  enable = async (dappName: string) => {
    if (!dappName) {
      throw new Error("MissingParamsError: Dapp name is required.")
    }

    const provider = await this.initializeProvider()

    if (!provider) {
      throw new Error(
        "WalletConnectError: WalletConnect provider is not initialized.",
      )
    }

    if (
      provider.session?.expiry &&
      provider.session.expiry < Math.floor(Date.now() / 1000)
    ) {
      provider.cleanupPendingPairings()
      provider.disconnect()

      // Clear IndexedDB for expired sessions to prevent mobile issues
      if (typeof window !== "undefined" && "indexedDB" in window) {
        try {
          const dbName = "WALLET_CONNECT_V2_INDEXED_DB"
          indexedDB.deleteDatabase(dbName)
        } catch {
          // Ignore errors
        }
      }

      throw new Error("WalletConnectError: Session is expired")
    }

    const namespace = this.namespace || provider.namespaces

    if (!namespace) {
      throw new Error(
        "WalletConnectError: Namespace is required to enable WalletConnect.",
      )
    }

    try {
      const session =
        provider.session ??
        (await provider.connect({
          optionalNamespaces: namespace,
        }))

      if (!session) {
        throw new Error(
          "WalletConnectError: Failed to create WalletConnect session.",
        )
      }

      this._session = session

      const accounts = await this.getAccounts()
      const namespaceKey = Object.keys(namespace).pop() as NamespaceType

      if (namespaceKey === "eip155" && provider instanceof UniversalProvider) {
        const mainAddress = accounts[0]?.address
        this._signer = mainAddress
          ? new EthereumSigner(mainAddress, provider)
          : undefined
      }

      if (namespaceKey === "polkadot" && provider.client) {
        // @ts-ignore - Version mismatch between WalletConnect SignClient types
        this._signer = new PolkadotSigner(provider.client, session)
      }
    } finally {
      this.modal?.closeModal()
    }
  }

  getAccounts = async (): Promise<WalletAccount[]> => {
    if (!this._session) {
      throw new Error(
        `The 'Wallet.enable(dappname)' function should be called first.`,
      )
    }

    const wcAccounts = Object.values(this._session.namespaces).flatMap(
      (namespace) => namespace.accounts,
    )

    // return only first (active) account
    return wcAccounts.slice(0, 1).map((wcAccount) => {
      const address = wcAccount.split(":")[2]
      return {
        address,
        source: this.extensionName,
        name: isEvmAddress(address)
          ? shortenAccountAddress(address)
          : this.title,
        wallet: this,
        signer: this.signer,
      }
    })
  }

  subscribeAccounts = async () => {}

  disconnect = () => {
    const provider = this._extension
    provider?.off("display_uri", this.handleDisplayUri)
    provider?.off("session_update", this.handleSessionUpdate)
    provider?.off("session_delete", this.handleSessionDelete)

    provider?.cleanupPendingPairings()
    const promise = provider?.disconnect?.() ?? Promise.resolve()
    promise.catch((err) => {
      const isExpectedError =
        err instanceof Error &&
        err.message.includes?.("Please call connect() before enable()")
      if (!isExpectedError) throw err
    })

    this._signer = undefined
    this._session = undefined
    this._extension = undefined

    if (typeof window !== "undefined") {
      if ("indexedDB" in window) {
        // reset previous saved settings of WC2 to avoid mismatch between EVM and Substrate
        indexedDB.deleteDatabase("WALLET_CONNECT_V2_INDEXED_DB")
      }
    }
  }
}
