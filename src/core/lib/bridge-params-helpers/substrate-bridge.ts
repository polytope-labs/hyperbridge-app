import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import type { AnyToken } from "@hyperbridge-fe/shared/types"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"

export class SubstrateBridgeHelper {
  constructor(
    public params: BridgeParamsHelper,
    private _token: AnyToken,
  ) {
    this.params = params
  }

  get source() {
    if (this.params.source.group !== "substrate") {
      throw new Error("Source Network must be Substrate")
    }

    return this.params.source
  }

  get destination() {
    return this.params.destination
  }

  get token() {
    return TokenImpl.match(this._token, {
      substrate: (x) => x,
      _: (token) => {
        throw new Error(
          `Expecting a Substrate token but got (${token?.name}) token`,
          { cause: { meta: { token } } },
        )
      },
    })
  }

  get assetId() {
    return TokenImpl.assetId(this._token)
  }
}
