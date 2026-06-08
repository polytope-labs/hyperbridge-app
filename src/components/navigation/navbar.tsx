import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Header,
  HeaderContent,
  HeaderGradient,
} from "@hyperbridge/ui"
import { Mainnet, Testnet } from "@hyperbridge/ui/icons"
import { resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import { Image } from "@unpic/react"
import { observer } from "mobx-react"
import { Link } from "react-router"
import { WalletConnectionButton } from "@/components/wallets/wallet-connection"
import { isAppStaging, isDevelopment } from "@/config/constants"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import If from "@/components/utils/if"
import { InitializeProviders } from "@/components/wallets/setup-provider"
import { MobileMenuTrigger } from "./mobile-menu"

/** Bridge app header only — edit here without affecting HyperFX. */
export const Navbar = () => {
  return (
    <Header>
      <InitializeProviders />
      <HeaderGradient />
      <HeaderContent className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MobileMenuTrigger />
          <Link to="/">
            <Image
              className="max-w-full shrink-0 object-contain"
              fetchPriority="high"
              src={resolvePublicUrl("/logo.svg")}
              alt="Hyperbridge Logo"
              width={149}
              height={32}
            />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            {isAppStaging || isDevelopment ? <NetworkEnvSwitch /> : null}
          </div>
          <WalletConnectionButton />
        </div>
      </HeaderContent>
    </Header>
  )
}

const NetworkEnvSwitch = observer(function NetworkEnvSwitch() {
  const current_env = gatewayConfig.environment

  const testnet = {
    key: "testnet",
    icon: <Testnet className="text-brand-black-100 size-4" />,
    text: "Testnet",
  }
  const mainnet = {
    key: "mainnet",
    icon: <Mainnet className="text-brand-black-100 size-4" />,
    text: "Mainnet",
  }

  const current_item = current_env === "mainnet" ? mainnet : testnet

  const active_badge = (
    <>
      &nbsp;&nbsp;
      <Badge variant="success">Active</Badge>
    </>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="level_1" className="!px-4">
          {current_item.icon}

          <span className="text-[calc(14rem/16)] first-letter:uppercase">
            {current_item.text}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-[calc(14rem/16)">
        {[mainnet, testnet].map((e) => {
          return (
            <DropdownMenuItem
              key={e.key}
              onClick={() => {
                gatewayConfig.toggleEnvironment()
                window.location.reload()
              }}
            >
              {e.icon}
              <span>{e.text}</span>
              <If cond={current_env === e.key}>{active_badge}</If>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
