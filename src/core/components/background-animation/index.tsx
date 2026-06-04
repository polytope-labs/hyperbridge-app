import React from "react"
import "./index.css"
import { useLocation } from "react-router"
import { AnimateGradient } from "./animations-logic"

export function BackgroundAnimation() {
  const div_ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const updateHeight = () => {
      if (div_ref.current) {
        const height = div_ref.current.offsetHeight
        document.documentElement.style.setProperty(
          "--hb-bg-height",
          `${height}px`,
        )
      }
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(updateHeight)
    if (div_ref.current) {
      resizeObserver.observe(div_ref.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const location = useLocation()

  React.useEffect(
    function backgroundAnimation() {
      function enableAnimation() {
        if (!div_ref.current) return

        const baseEl: HTMLElement | null =
          div_ref.current.querySelector(".base")

        if (!baseEl) {
          throw new Error("[BackgroundAnimation] Base element not found")
        }

        const inputEl: HTMLInputElement[] = Array.from(
          document.body.querySelectorAll("input"),
        )

        const ins = new AnimateGradient(baseEl)

        for (const input of inputEl) {
          if (input.dataset.testid === "sender-amount-input") {
            ins.observeForInput(input)
          }
        }

        ins.play()

        return ins
      }

      const instance = enableAnimation()

      return () => {
        instance?.stop()
      }
    },
    [location],
  )

  return (
    <div className="absolute inset-x-0 z-[-1]">
      <div
        ref={div_ref}
        className="hb-bg relative mx-auto aspect-[19/6] h-full max-h-[22.8125rem] w-full overflow-hidden"
      >
        <div className="base pointer-events-none" data-state="inactive">
          <div className="mask" />

          <div className="layer-2">
            <div className="soft-linear-overlay" />
            <div className="soft-linear-overlay soft-linear-overlay-mirror" />
          </div>

          <svg>
            <title>Effects</title>
            <defs>
              <filter
                id="filter0_f_4029_6538"
                x="-67.383"
                y="0.617012"
                width="907.766"
                height="695.766"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="BackgroundImageFix"
                  result="shape"
                />
                <feGaussianBlur
                  stdDeviation="28.6915"
                  result="effect1_foregroundBlur_4029_6538"
                />
              </filter>
            </defs>
          </svg>

          <svg
            className="overlay"
            viewBox="0 0 773 562"
            fill="none"
            style={{
              aspectRatio: `773 / 562`,
              minWidth: "25%",
              height: `var(--hb-bg-height)`,
            }}
          >
            <title>ZigZag</title>
            <g filter="url(#filter0_f_4029_6538)">
              <path
                d="M773 561.386L-0.000489809 561.386L47.4736 463.939L263.171 386.68L117.5 309.422L386.5 267.781L221.5 149.5L317.5 102.104L76.2549 5.04504L773 0.38623L773 561.386Z"
                fill="var(--color-brand-black-600)"
              />
            </g>
          </svg>

          <svg
            className="overlay overlay-mirror"
            viewBox="0 0 773 562"
            fill="none"
            style={{
              aspectRatio: `773 / 562`,
              minWidth: "25%",
              height: `var(--hb-bg-height)`,
            }}
          >
            <title>ZigZag</title>
            <g filter="url(#filter0_f_4029_6538)">
              <path
                d="M745 561.476L261.202 561.476L162.308 464.028L235.171 386.77L6.5629 309.511L117.03 253.798L75.3278 178.734L193.5 102.193L0.263123 0.475599L745 0.475599L745 561.476Z"
                fill="var(--color-brand-black-600)"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
