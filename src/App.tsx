import "@/lib/dev-injections"
import { Footer, Navbar } from "./components/navigation"
import { MobileMenuDrawer } from "./components/navigation/mobile-menu"
import { Providers } from "@/components/providers"
import { MAINTENANCE_MODE } from "@/config/constants"
import { WagmiConfig } from "@/config/wagmi"
import { registerBridgeMediatorCleanup } from "@/lib/transactions/tx-mediator"
import { BridgeHomePage } from "@/pages/bridge-home"
import { NotFoundPage } from "@/pages/not-found"
import { fullRefresh } from "./stores/transfer-actions"
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ConnectKitProvider } from "connectkit"
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { BrowserRouter } from "react-router"
import { Toaster } from "sonner"
import { WagmiProvider } from "wagmi"

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true,
})

registerBridgeMediatorCleanup(fullRefresh)

const queryClient = new QueryClient()

const WalletDrawer = lazy(() =>
  import("@/components/wallets/wallet-drawer").then((module) => ({
    default: module.WalletDrawer,
  })),
)

const TxRemoteDialog = lazy(() =>
  import("./components/mediator-control").then((module) => ({
    default: module.TxRemoteDialog,
  })),
)

function AppShell() {
  if (MAINTENANCE_MODE) {
    return (
      <div className="bg-brand-black-600 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <img src="/logo.svg" alt="Hyperbridge" className="mb-10 h-10" />
        <h1 className="text-brand-white-500 mb-4 text-3xl font-semibold">
          Under Maintenance
        </h1>
        <p className="text-brand-black-100 max-w-md text-base">
          We're currently paused due to a Polkadot network update. We'll be back
          shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-(--header-height)">
        <Routes>
          <Route path="/" element={<BridgeHomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <WalletDrawer />
        <MobileMenuDrawer product="bridge" />
        <TxRemoteDialog />
      </Suspense>
      <Toaster
        position="bottom-right"
        richColors={false}
        closeButton={false}
        expand={false}
        visibleToasts={4}
        toastOptions={{
          style: {
            width: "min(calc(440rem/16), calc(100vw - 1rem))",
          },
        }}
      />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <WagmiProvider config={WagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <Providers>
              <AppShell />
            </Providers>
          </ConnectKitProvider>
          {import.meta.env.DEV ? (
            <ReactQueryDevtools initialIsOpen={false} />
          ) : null}
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  )
}
