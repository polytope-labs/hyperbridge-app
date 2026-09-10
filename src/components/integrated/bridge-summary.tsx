import { transferState } from "@app/stores/transfer"
import {
  bridgeParams,
  estimatedTransferTime,
  inferSeverity,
  safeAccountAddress,
  safeBridgeFee,
  txFeeInNativeToken,
  txFeeInUSD,
} from "@app/stores/transfer-computed"
import { makeEntry, Summary, SummaryValues } from "@hyperbridge/ui"
import { ChevronBottomDown, Clock, Gas, Percent } from "@hyperbridge/ui/icons"
import { HydrationMainnet, shortenAccountAddress } from "@hyperbridge-fe/shared"
import { getBalance } from "@wagmi/core"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { domAnimation, LazyMotion, m } from "motion/react"
import React from "react"
import { Loader } from "@/components/common/Loader"
import {
  AsyncValue,
  AsyncValueFallback,
  Value,
} from "@/components/exchange-value"
import { AsyncTokenValue, TokenValue } from "@/components/integrated/values"
import If from "@/components/utils/if"
import { WagmiConfig } from "@/config/wagmi"
import { BalanceImpl } from "@/lib/factories/balance"
import { FiatImpl } from "@/lib/factories/fiat"
import { isHftToken } from "@/lib/hft/hyper-fungible-token"
import { cn } from "@/lib/utils"
import { O, pipe } from "@/lib/utils/fp.helpers"
import type { AppBalance } from "@/types"

export const BridgeSummarySection = observer(function BridgeSummarySection() {
  const [expand, setExpand] = React.useState(false)
  const toggleButtonRef = React.useRef<HTMLButtonElement>(null)

  const [severity] = inferSeverity.get()
  const reveal = severity === "default"
  const bridge_params = bridgeParams.get()

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ height: 0, paddingTop: 0 }}
        animate={{
          height: reveal ? "auto" : 0,
          paddingTop: reveal ? "1rem" : "0rem",
        }}
        className={
          "-mt-4 grid min-h-0 overflow-hidden transition-all duration-200 ease-out"
        }
      >
        <div>
          {/* Bridge Header */}
          <div
            id="bridge-header"
            role="tab"
            tabIndex={0}
            aria-selected={expand}
            className="text-brand-black-100 flex cursor-pointer items-center justify-between"
            onClick={() => toggleButtonRef.current?.click?.()}
            onKeyDown={() => toggleButtonRef.current?.click?.()}
          >
            <section className="flex h-[1rem] flex-col items-center gap-0 overflow-hidden">
              <m.div
                initial={{ marginTop: "0rem" }}
                animate={{ marginTop: !expand ? "-1rem" : "0rem" }}
              >
                <span className="text-caption text-brand-black-100 flex font-medium opacity-50">
                  Bridge summary
                </span>

                <ul className="m-0 flex h-[1rem] items-center gap-3">
                  <If cond={bridge_params.direction() === "evm->evm"}>
                    <li className="inline-flex items-center gap-1">
                      <Gas className="size-[14px]" />
                      <span className="text-caption font-medium">
                        <GasFee />
                      </span>
                    </li>
                  </If>

                  <If
                    cond={
                      bridge_params.direction() === "substrate->evm" &&
                      bridge_params.source.group === "relay" &&
                      O.isSome(safeBridgeFee.get())
                    }
                  >
                    <li className="inline-flex items-center gap-1">
                      <Percent className="size-[14px]" />
                      <span className="text-caption font-medium">
                        <BridgeFee />
                      </span>
                    </li>
                  </If>

                  <If
                    cond={
                      bridge_params.direction() === "substrate->evm" &&
                      (bridge_params.source.group === "substrate" ||
                        O.isNone(safeBridgeFee.get()))
                    }
                  >
                    <li className="inline-flex items-center gap-1">
                      <Clock className="size-[14px]" />
                      <span className="text-caption font-medium">
                        <EtaValue />
                      </span>
                    </li>
                  </If>

                  <If cond={bridge_params.direction() === "evm->substrate"}>
                    <li className="inline-flex items-center gap-1">
                      <Clock className="size-[14px]" />
                      <span className="text-caption font-medium">
                        <EtaValue />
                      </span>
                    </li>
                  </If>
                </ul>
              </m.div>
            </section>

            <m.button
              ref={toggleButtonRef}
              type="button"
              onClick={(evt) => {
                evt.stopPropagation()
                return setExpand((e) => !e)
              }}
              className="flex cursor-pointer items-center gap-[2px] transition-colors duration-200 hover:text-white"
            >
              {expand ? (
                <span className="text-caption font-medium">Hide</span>
              ) : (
                <span className="text-caption font-medium">Details</span>
              )}
              <ChevronBottomDown
                className={cn("size-[14px] transition duration-200", {
                  "rotate-180": expand,
                })}
              />
            </m.button>
          </div>

          {/* Bridge Content */}
          <m.section
            id="bridge-content"
            className="mt-1 overflow-hidden"
            initial={{ height: 0 }}
            animate={{ height: expand ? "auto" : 0 }}
          >
            <BridgeSummaryContent />
          </m.section>
        </div>
      </m.div>
    </LazyMotion>
  )
})

const { Key, Values } = SummaryValues

export const BridgeSummaryContent = observer(function BridgeSummaryContent() {
  return (
    <Summary>
      <Key.RecipientAddress>
        <Values.Highlight>
          {shortenAccountAddress(transferState.recipient)}
        </Values.Highlight>
      </Key.RecipientAddress>

      {safeBridgeFee.get().pipe(
        O.map(() => {
          return (
            <Key.Bridge key="bridge-fee">
              <React.Suspense fallback={<Loader />}>
                <Values.Highlight>
                  <BridgeFee />
                </Values.Highlight>
              </React.Suspense>
            </Key.Bridge>
          )
        }),
        O.getOrNull,
      )}

      <If cond={showGasInfo.get()}>
        <Fees>
          <GasFee key={"gas-fee"} mode="full" />
        </Fees>
      </If>

      <Key.ETA>
        <Values.Highlight>
          <EtaValue />
        </Values.Highlight>
      </Key.ETA>
    </Summary>
  )
})

const Fees = makeEntry({
  icon: () => <Gas />,
  name: "Fees",
})

function EtaValue() {
  return <>{estimatedTransferTime.get()}</>
}

const GasFee = observer(function GasFee(props: { mode?: "full" | "compact" }) {
  const { mode = "full" } = props
  const bridge_params = bridgeParams.get()
  const token = transferState.token

  if (
    bridge_params.direction() === "evm->evm" &&
    token.__type === "evm" &&
    isHftToken(token)
  ) {
    return (
      <React.Suspense fallback={<Loader />}>
        <Values.Highlight>
          <AsyncTokenValue
            suspend={false}
            promise={transferState.relayerFeeToken.then(O.some)}
            minisculeValueFallback={"<0.0001 USDH"}
          />
        </Values.Highlight>
      </React.Suspense>
    )
  }

  if (bridge_params.destination.chainId === HydrationMainnet.chainId) {
    return (
      <Value
        data={FiatImpl.asDollar(0.05)}
        mode="default"
        symbolView="hide"
        maximumFractionDigits={2}
        minisculeValueFallback={undefined}
      />
    )
  }

  const native_token_value = getGasFeeInNativeToken.get()

  const gas_fee_in_native_token = (
    <AsyncValueFallback>
      <AsyncTokenValue promise={native_token_value} suspend={false} />
    </AsyncValueFallback>
  )

  return (
    <React.Suspense fallback={<Loader />}>
      <Values.Highlight>
        <AsyncValueFallback>
          <AsyncValue
            suspend={false}
            maximumFractionDigits={4}
            mode="approximate"
            promise={txFeeInUSD.get()}
            minisculeValueFallback={"<0.0001 USD"}
          />
        </AsyncValueFallback>
      </Values.Highlight>
      <If cond={mode === "full"}>&nbsp;({gas_fee_in_native_token})</If>
    </React.Suspense>
  )
})

const BridgeFee = observer(function BridgeFee() {
  return (
    <>
      {safeBridgeFee.get().pipe(
        O.map((fee) => {
          return (
            <TokenValue
              key={"bridge-value"}
              data={fee}
              minisculeValueFallback={<>&lt;0.1% DOT</>}
            />
          )
        }),
        O.getOrNull,
      )}
    </>
  )
})

const showGasInfo = computed(() => {
  const params = bridgeParams.get()

  if (params.direction() === "evm->evm") return true

  if (params.destination.chainId === HydrationMainnet.chainId) {
    return true
  }

  return false
})

const getGasFeeInNativeToken = computed(
  async (): Promise<O.Option<AppBalance>> => {
    const account = pipe(
      safeAccountAddress.get(),
      // O.filter(isEvmAddress)
    )
    const bridge_params = bridgeParams.get()

    if (!O.isSome(account)) return O.none()

    try {
      // For EVM->EVM transactions, use the pre-calculated nativeCost
      if (
        bridge_params.direction() === "evm->evm" &&
        transferState.nativeCost
      ) {
        const native_token = await getBalance(WagmiConfig, {
          address: account.value,
          chainId: transferState.sourceChain as number,
        })

        return O.some(
          BalanceImpl.create(
            transferState.nativeCost,
            native_token.decimals,
            native_token.symbol,
          ),
        )
      }

      return await txFeeInNativeToken.get()
    } catch (error) {
      console.error("Failed to get gas fee in native token:", error)
      return O.none()
    }
  },
)
