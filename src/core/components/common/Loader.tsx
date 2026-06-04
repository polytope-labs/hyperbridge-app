import { Image } from "@unpic/react"

export const Loader = ({ size = 12 }) => {
  return (
    <div className="animate-spin" style={{ width: size, height: size }}>
      <Image
        src="/assets/illustrations/loader.png"
        alt="loader"
        width={size}
        priority={true}
        fetch-priority="high"
        height={size}
      />
    </div>
  )
}
