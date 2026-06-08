import type { TxError } from "@hyperbridge-fe/shared/types"
import type { HexString } from "@polkadot/util/types"
import { type Config, getAccount, getPublicClient, writeContract } from "@wagmi/core"
import {
  type Abi,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type EstimateContractGasParameters,
} from "viem"
import { type WagmiChainId } from "@/config/wagmi"
import type { TxCreationEvents } from "@/types/tx"

export function resolveTxError(
  error: Extract<TxCreationEvents, { kind: "Error" }>["error"],
): TxError {
  if (typeof error === "string") {
    return {
      kind: "InitError",
      error,
      timestamp: Date.now(),
    }
  }

  return error
}

export async function estimateGasBuffered<
  chain extends Chain | undefined,
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  >,
>(
  config: Config,
  account_params: { account: HexString; chainId: number },
  args: EstimateContractGasParameters<abi, functionName, args, chain>,
): Promise<{ bufferedGas: bigint; chain: Chain | undefined }> {
  const publicClient = getPublicClient(config, {
    chainId: account_params.chainId,
  })

  if (!publicClient) {
    throw new Error(
      `Public client not found for Chain(${account_params.chainId})`,
    )
  }

  // @ts-expect-error No sure why this warns
  const estimatedGas = await publicClient.estimateContractGas({
    account: account_params.account,
    chain: publicClient.chain,
    ...args,
  })

  const bufferedGas = (estimatedGas * 15n) / 10n

  return {
    bufferedGas,
    chain: publicClient.chain,
  }
}

export async function writeContractBuffered<
  chain extends Chain | undefined,
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  >,
>(
  config: Config,
  accountParams: {
    account?: HexString
    chainId: number
  },
  params: EstimateContractGasParameters<abi, functionName, args, chain>,
) {
  const resolvedAccount =
    accountParams.account ??
    (getAccount(config).address as HexString | undefined)

  if (!resolvedAccount) {
    throw new Error(
      `Connected account not found for Chain(${accountParams.chainId})`,
    )
  }

  const { bufferedGas, chain } = await estimateGasBuffered(
    config,
    {
      account: resolvedAccount,
      chainId: accountParams.chainId,
    },
    params,
  )

  return await writeContract(config, {
    ...params,
    account: resolvedAccount,
    chain,
    chainId: accountParams.chainId as WagmiChainId,
    gas: bufferedGas,
  } as never)
}
