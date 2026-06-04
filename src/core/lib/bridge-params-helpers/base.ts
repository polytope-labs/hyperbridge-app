import type { estimateGasForPost } from "@hyperbridge/sdk"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { formatUnits } from "viem"
import type { RootHelperParams } from "@/types/tx"
import { O } from "../utils/fp.helpers.ts"
import { safeNetworkConfig } from "../utils.ts"

export type EstimateGasForPostParams = Parameters<typeof estimateGasForPost>[0]

export class BridgeParamsHelper {
  constructor(public bridgeParams: RootHelperParams) {}

  get source() {
    return safeNetworkConfig(this.bridgeParams.source).pipe(
      O.getOrThrowWith(() => new Error("Source Network required")),
    )
  }

  get destination() {
    return safeNetworkConfig(this.bridgeParams.destination).pipe(
      O.getOrThrowWith(() => new Error("Destination Network required")),
    )
  }

  /**
   * @todo: Rename to bridge network path
   * @returns
   */
  direction() {
    return `${NetworkImpl.group(this.source)}->${NetworkImpl.group(this.destination)}` as const
  }

  get formatted_amount() {
    return formatUnits(
      this.bridgeParams.amount,
      this.bridgeParams.token.decimals,
    )
  }
}
