export type ProductKind = "bridge" | "hyperfx"

const bridgeAppUrl = import.meta.env.VITE_BRIDGE_APP_URL
const hyperfxAppUrl = import.meta.env.VITE_HYPERFX_APP_URL

export const socialLinks = [
  {
    label: "X",
    href: "https://x.com/hyperbridge",
    isExternal: true,
  },
  {
    label: "Telegram",
    href: "https://t.me/hyper_bridge",
    isExternal: true,
  },
  {
    label: "Discord",
    href: "https://discord.com/invite/WYTUQrTR9y",
    isExternal: true,
  },
]

export const footerLinks = [
  {
    label: "Docs",
    href: "https://docs.hyperbridge.network",
    isExternal: true,
  },
]

export const mobileLinks = [
  {
    label: "Community & Docs",
    sublinks: [
      {
        label: "Docs",
        href: "https://docs.hyperbridge.network",
        isExternal: true,
      },
      {
        label: "Twitter",
        href: "https://x.com/hyperbridge",
        isExternal: true,
      },
      {
        label: "Telegram",
        href: "https://t.me/hyper_bridge",
        isExternal: true,
      },
      {
        label: "Discord",
        href: "https://discord.com/invite/WYTUQrTR9y",
        isExternal: true,
      },
    ],
  },
]

export type MobileMenuLink = {
  label: string
  href: string
  img: string
  isExternal?: boolean
}

export function getMobileMenuLinks(product: ProductKind): MobileMenuLink[] {
  const links: MobileMenuLink[] = []

  if (product !== "bridge" && bridgeAppUrl) {
    links.push({
      label: "Bridge",
      href: bridgeAppUrl,
      img: "/assets/illustrations/bridge.svg",
      isExternal: true,
    })
  }

  if (product !== "hyperfx" && hyperfxAppUrl) {
    links.push({
      label: "HyperFX",
      href: hyperfxAppUrl,
      img: "/assets/illustrations/intents.svg",
      isExternal: true,
    })
  }

  links.push({
    label: "Explorer",
    href: "https://explorer.hyperbridge.network/",
    img: "/assets/illustrations/explorer.svg",
    isExternal: true,
  })

  return links
}

export const mobileMenuBottomLinks = [
  {
    label: "Community",
    sublinks: [
      {
        label: "X",
        href: "https://x.com/hyperbridge",
        isExternal: true,
      },
      {
        label: "Telegram",
        href: "https://t.me/hyper_bridge",
        isExternal: true,
      },
      {
        label: "Discord",
        href: "https://discord.com/invite/WYTUQrTR9y",
        isExternal: true,
      },
    ],
  },
  {
    label: "Resources",
    sublinks: [
      {
        label: "Blog",
        href: "https://blog.hyperbridge.network",
        isExternal: true,
      },
      {
        label: "Docs",
        href: "https://docs.hyperbridge.network",
        isExternal: true,
      },
    ],
  },
]
