import { HBDrawer, HBDrawerContent, Text } from "@hyperbridge/ui"
import { Mainnet, Testnet } from "@hyperbridge/ui/icons"
import { Image } from "@unpic/react"
import { observable } from "mobx"
import { observer } from "mobx-react"
import { domAnimation, LazyMotion, m } from "motion/react"
import { Link } from "react-router"
import { isAppStaging, isDevelopment } from "@/config/constants"
import {
  getMobileMenuLinks,
  mobileMenuBottomLinks,
  type ProductKind,
} from "@/config/navigation"
import { gatewayConfig } from "@/config/services/gateway-config"
import { cn } from "@/lib/utils"
import If from "@/components/utils/if"

const mobileMenuStore = observable({
  isOpen: false,
  toggle: () => {
    mobileMenuStore.isOpen = !mobileMenuStore.isOpen
  },
  close: () => {
    mobileMenuStore.isOpen = false
  },
  open: () => {
    mobileMenuStore.isOpen = true
  },
})

const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => {
  return (
    <LazyMotion features={domAnimation}>
      <div className="flex size-7 flex-col justify-center space-y-1.5 p-[2px]">
        <m.div
          className="h-[1.5px] w-full shrink-0 rounded-lg bg-current"
          animate={{
            rotate: isOpen ? 45 : 0,
            y: isOpen ? 7.5 : 0,
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{
            transformOrigin: "center",
          }}
        />
        <m.div
          className="h-[1.5px] w-full shrink-0 rounded-lg bg-current"
          animate={{
            opacity: isOpen ? 0 : 1,
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        />
        <m.div
          className="h-[1.5px] w-full shrink-0 rounded-lg bg-current"
          animate={{
            rotate: isOpen ? -45 : 0,
            y: isOpen ? -7.5 : 0,
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{
            transformOrigin: "center",
          }}
        />
      </div>
    </LazyMotion>
  )
}

const MobileNetworkEnvSwitch = observer(function MobileNetworkEnvSwitch() {
  const current_env = gatewayConfig.environment

  const options = [
    {
      key: "mainnet",
      label: "Nexus",
      icon: <Mainnet className="size-4 text-gray-400" />,
    },
    {
      key: "testnet",
      label: "Gargantua",
      icon: <Testnet className="size-4 text-gray-400" />,
    },
  ]

  return (
    <div className="bg-brand-black-600 flex gap-1 rounded-lg p-1">
      {options.map((option) => {
        const isActive = current_env === option.key
        return (
          <button
            type="button"
            key={option.key}
            onClick={() => {
              if (!isActive) {
                gatewayConfig.toggleEnvironment()
                window.location.reload()
              }
            }}
            className={cn(
              "flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-brand-black-500 text-white shadow-sm"
                : "hover:bg-brand-black-500/50 text-gray-300 hover:text-white",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
})

export const MobileMenuTrigger = observer(() => {
  return (
    <button
      type="button"
      className="md:hidden"
      onClick={() => mobileMenuStore.toggle()}
    >
      <HamburgerIcon isOpen={mobileMenuStore.isOpen} />
    </button>
  )
})

export const MobileMenuDrawer = observer(function MobileMenuDrawer(
  props: { product?: ProductKind } = {},
) {
  const mobileMenuLinks = getMobileMenuLinks(props.product ?? "bridge")

  return (
    <div className="md:hidden">
      <HBDrawer
        open={mobileMenuStore.isOpen}
        onOpenChange={(open) =>
          open ? mobileMenuStore.open() : mobileMenuStore.close()
        }
      >
        <HBDrawerContent className="bg-brand-black-550 !inset-x-3 !bottom-4 min-h-[90svh] overflow-hidden rounded-[12px]">
          <div className="mt-2">
            <If cond={isAppStaging || isDevelopment}>
              <MobileNetworkEnvSwitch />
            </If>

            <nav className="mt-8 space-y-4">
              {mobileMenuLinks.map((link) =>
                link.isExternal ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-lg font-medium leading-[1.4] text-white transition-all duration-150 hover:text-gray-300"
                    onClick={() => mobileMenuStore.close()}
                  >
                    <Image
                      src={link.img}
                      alt={link.label}
                      width={24}
                      height={24}
                    />
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="flex items-center gap-3 text-lg font-medium leading-[1.4] text-white transition-all duration-150 hover:text-gray-300"
                    onClick={() => mobileMenuStore.close()}
                  >
                    <Image
                      src={link.img}
                      alt={link.label}
                      width={24}
                      height={24}
                    />
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          </div>

          <div className="-mx-4 mt-auto">
            <div className="grid grid-cols-2 gap-[86px] border-t-4 border-[#131417] px-3 py-6">
              {mobileMenuBottomLinks.map((link) => (
                <div key={link.label}>
                  <Text
                    variant="caption"
                    className="text-brand-black-100 font-medium uppercase leading-[1.4] tracking-widest"
                  >
                    {link.label}
                  </Text>
                  <If cond={link.sublinks.length > 0}>
                    <div className="mt-6 flex flex-col space-y-4">
                      {link.sublinks.map((sublink) => (
                        <Link
                          key={sublink.label}
                          to={sublink.href}
                          target={sublink.isExternal ? "_blank" : "_self"}
                          rel={
                            sublink.isExternal
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className="text-sm font-medium leading-[1.2] text-white"
                        >
                          {sublink.label}
                        </Link>
                      ))}
                    </div>
                  </If>
                </div>
              ))}
            </div>
          </div>
        </HBDrawerContent>
      </HBDrawer>
    </div>
  )
})
