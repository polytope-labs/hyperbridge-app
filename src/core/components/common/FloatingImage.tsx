import { Image } from "@unpic/react"
import { domAnimation, LazyMotion, m } from "motion/react"
import { cn } from "@/lib/utils"

export function FloatingImage(props: {
  src: string
  alt: string
  className: string
  delay?: number
  duration?: number
  yRange?: [number, number]
  xRange?: [number, number]
  rotateRange?: [number, number]
  rotationDuration?: number
}) {
  const {
    src,
    alt,
    className,
    delay = 0,
    duration = 6,
    yRange = [-20, 20],
    xRange = [-5, 5],
    rotateRange = [-3, 3],
    rotationDuration = 8,
  } = props

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={cn("relative shrink-0", className)}
        initial={{ y: 0, x: 0, rotate: 0 }}
        animate={{
          y: yRange,
          x: xRange,
          rotate: rotateRange,
        }}
        transition={{
          duration: duration,
          delay: delay,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
          ease: "easeInOut",
          rotate: {
            duration: rotationDuration,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
          },
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={200}
          height={200}
          className={cn("absolute inset-0", className)}
        />
      </m.div>
    </LazyMotion>
  )
}
