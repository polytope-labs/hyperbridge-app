import { Duration } from "effect"
import { computed, observable } from "mobx"
import { makePersistable } from "mobx-persist-store"
import { safeNum } from "@/lib/data.helpers"
import { ms } from "@/lib/utils/date.helpers"

const DEFAULT_TIMEOUT = ms("6 hours")

interface SettingsState {
  isOpen: boolean
  onClose: () => void
  slippage?: string
  deadline: string
  type: "bridge"
  slippageMode: "custom" | "preset"
  slippageValue: string
  slippageTooltipText?: string
  deadlineTooltipText?: string
}

export const settingsStore = observable<SettingsState>({
  isOpen: false,
  onClose: () => {},
  slippageMode: "preset",
  slippage: "Auto",
  slippageValue: "",
  deadline: String(Duration.toMinutes(DEFAULT_TIMEOUT)),
  type: "bridge",
  slippageTooltipText: undefined,
  deadlineTooltipText: undefined,
})

export const setSlippage = (
  selectedSlippage: string,
  mode: "custom" | "preset",
) => {
  settingsStore.slippageMode = mode
  settingsStore.slippage = selectedSlippage
}

export const slippageValueParsed = computed((): number => {
  return safeNum(Number.parseFloat(settingsStore.slippageValue), 0)
})

makePersistable(settingsStore, {
  name: "hyperbridge_app_settings",
  properties: ["deadline", "slippage", "slippageMode"],
  storage: window.localStorage,
})
