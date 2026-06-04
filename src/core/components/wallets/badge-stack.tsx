import { BadgeIcon } from "@hyperbridge/ui"
import type { HBUIAccount } from "@/types/network-types"

export const BadgeStack = ({ items }: { items: HBUIAccount[] }) => {
  return (
    <div className="inline-flex -space-x-[0.3125rem]">
      {items.map((item, index) => {
        const badgeSrc = item.network.image
        const badgeAlt = item.network.name
        const key = `${item.wallet.name}:${item.network.name}`

        return (
          <div
            key={key}
            style={{ zIndex: items.length - index, position: "relative" }}
          >
            <BadgeIcon
              outline
              src={item.wallet.image}
              alt={item.wallet.name}
              size="1.5rem"
              badgeSrc={badgeSrc}
              badgeAlt={badgeAlt}
              className="bg-white"
            />
          </div>
        )
      })}
    </div>
  )
}
