import {
  Input,
  Modal,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hyperbridge/ui"
import { CircleInfo } from "@hyperbridge/ui/icons"
import { Slot } from "@radix-ui/react-slot"
import { clamp } from "effect/Number"
import { XIcon } from "lucide-react"
import { observer } from "mobx-react"
import { cn } from "@/lib/utils"
import {
  setSlippage,
  settingsStore,
  slippageValueParsed,
} from "@/stores/settings"
import { NumPad } from "./slots/numpad"

// Generic fallback tooltip texts
const DEFAULT_TOOLTIP_TEXTS = {
  slippage:
    "Bridge slippage tolerance helps protect against price changes during cross-chain transaction processing",
}

const PRESET_SLIPPAGES = ["Auto", "0.25%", "0.5%", "0.75%", "1%"]

const isSlippageSelected = (option: string) => {
  const slippage = settingsStore.slippage

  if (option === "Custom") {
    return slippage !== "Auto" && !PRESET_SLIPPAGES.includes(String(slippage))
  }

  return slippage === option
}

export const SettingsDialog = observer(function SettingsDialog() {
  const onClose = () => {
    settingsStore.isOpen = false
  }

  return (
    <Modal
      className="!h-max p-4"
      isOpen={settingsStore.isOpen}
      onClose={onClose}
    >
      <div className="flex items-center justify-between">
        <div className="body-1 max-w-[200px] break-words font-medium text-white">
          Bridge settings
        </div>
        <XIcon
          className="text-brand-black-100 size-4 cursor-pointer transition-colors duration-200 hover:text-white"
          onClick={onClose}
        />
      </div>

      <div className="mt-4">
        <div className="text-brand-black-100 flex items-center gap-1">
          <p className="text-caption">Bridge Slippage</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleInfo className="size-[14px] cursor-pointer transition-colors duration-200 hover:text-white" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-caption">{DEFAULT_TOOLTIP_TEXTS.slippage}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {PRESET_SLIPPAGES.map((option) => (
            <div
              key={option}
              className={cn(
                "relative rounded-2xl p-[1.5px]",
                isSlippageSelected(option)
                  ? "animated-gradient-border"
                  : "bg-transparent",
              )}
            >
              <button
                type="button"
                onClick={() => setSlippage(option, "preset")}
                className="bg-brand-card-100 hover:bg-brand-card-100/80 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[16px] p-[14px] transition-colors duration-200"
              >
                <p className="body-1 font-medium">{option}</p>
              </button>
            </div>
          ))}

          <div
            className={cn(
              "relative rounded-2xl p-[1.5px]",
              settingsStore.slippageMode === "custom"
                ? "animated-gradient-border"
                : "bg-transparent",
            )}
          >
            <div className="bg-brand-card-100 relative rounded-[16px]">
              <NumPad>
                <Input
                  min={0}
                  max={100}
                  type="number"
                  placeholder="Custom"
                  className="focus-visible:ring-brand-black-100 body-1 h-12 w-full rounded-[16px] border-none bg-transparent p-4 pr-8 focus-visible:ring-1"
                  defaultValue={settingsStore.slippageValue}
                  onFocus={() => {
                    setSlippage(`${settingsStore.slippage}%`, "custom")
                  }}
                  onBlur={(e) => {
                    settingsStore.slippageValue = e.target.value

                    const new_value = clamp({ minimum: 0, maximum: 100 })(
                      slippageValueParsed.get(),
                    )

                    e.currentTarget.value = String(new_value)
                    settingsStore.slippage = String(new_value)
                  }}
                />
              </NumPad>
              <span className="body-1 text-brand-black-100 absolute right-4 top-1/2 -translate-y-1/2">
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disabled Timeout Settings input because we won't want any transaction to timeout */}
      {/*<div className="mt-6">
        <div className="text-brand-black-100 flex items-center gap-1">
          <p className="text-caption">{title} deadline</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleInfo className="size-[14px] cursor-pointer transition-colors duration-200 hover:text-white" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-caption">{deadlineText}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="relative mt-3">
          <NumPad>
            <Input
              min={0}
              type="number"
              defaultValue={deadline}
              placeholder="Enter deadline"
              className="bg-brand-card-100 focus-visible:ring-brand-black-100 body-1 pr-18 h-12 w-full rounded-[16px] border-none p-4 focus-visible:ring-1"
              onChange={(e) => {
                const value = e.target.value
                settingsStore.deadline = value
              }}
              onBlur={(e) => {
                const value = Number.parseFloat(e.target.value)
                if (value < 0) {
                  e.target.value = "0"
                  settingsStore.deadline = "0"
                }
              }}
            />
          </NumPad>
          <span className="body-1 text-brand-black-100 absolute right-4 top-1/2 -translate-y-1/2">
            minutes
          </span>
        </div>
      </div>*/}
    </Modal>
  )
})

export const SettingsTrigger = (props: {
  type?: "bridge"
  children: React.ReactNode
}) => {
  const { children, type = "bridge" } = props

  return (
    <Slot
      onClick={() => {
        settingsStore.type = type
        settingsStore.isOpen = !settingsStore.isOpen
      }}
    >
      {children}
    </Slot>
  )
}
