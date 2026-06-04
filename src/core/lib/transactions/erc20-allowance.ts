import { erc20Abi, type Hex } from "viem"

type AllowanceReader = {
  readContract: (params: {
    address: Hex
    abi: typeof erc20Abi
    functionName: "allowance"
    args: [Hex, Hex]
  }) => Promise<bigint>
}

export async function readErc20Allowance(params: {
  client: AllowanceReader
  token: Hex
  owner: Hex
  spender: Hex
}): Promise<bigint> {
  const { client, token, owner, spender } = params
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>
}

export async function isErc20AllowanceInsufficient(params: {
  client: AllowanceReader
  token: Hex
  owner: Hex
  spender: Hex
  required: bigint
}): Promise<boolean> {
  const allowance = await readErc20Allowance(params)
  return allowance < params.required
}

export async function ensureExactErc20Allowance(params: {
  readAllowance: () => Promise<bigint>
  required: bigint
  approvalAmount?: bigint
  submitApproval: (amount: bigint) => Promise<void>
  verifyAttempts?: number
  waitBetweenAttemptsMs?: number
  sleep?: (ms: number) => Promise<void>
  insufficientAllowanceMessage?: string
}): Promise<boolean> {
  const {
    readAllowance,
    required,
    approvalAmount = required,
    submitApproval,
    verifyAttempts = 1,
    waitBetweenAttemptsMs = 0,
    sleep,
    insufficientAllowanceMessage = "Approval confirmed, but allowance is still insufficient",
  } = params

  const allowance = await readAllowance()
  if (allowance >= required) {
    return false
  }

  if (allowance > 0n) {
    await submitApproval(0n)
  }

  await submitApproval(approvalAmount)

  for (let attempt = 0; attempt < verifyAttempts; attempt += 1) {
    const updatedAllowance = await readAllowance()
    if (updatedAllowance >= required) {
      return true
    }

    if (attempt < verifyAttempts - 1 && waitBetweenAttemptsMs > 0 && sleep) {
      await sleep(waitBetweenAttemptsMs)
    }
  }

  throw new Error(insufficientAllowanceMessage)
}
