import type { HexString } from "@hyperbridge/sdk"
import { erc20Abi, type PublicClient } from "viem"
import { EvmHostABI } from "@/abis/EvmHost"

/**
 * Helper functionality for reading ISMP Host Chain FeeToken.
 * Fee tokens are stable tokens on these Chain. eg. USDC, DAI, USDT etc
 */
export class FeeToken {
  host: HexString

  constructor(
    private publicClient: PublicClient,
    ismpHostAddress: HexString,
  ) {
    this.host = ismpHostAddress
  }

  hostParams() {
    return this.publicClient.readContract({
      abi: EvmHostABI,
      address: this.host,
      functionName: "hostParams",
    })
  }

  async feeTokenAddress() {
    return (await this.hostParams()).feeToken
  }

  async getSymbol() {
    return this.publicClient.readContract({
      address: await this.feeTokenAddress(),
      abi: erc20Abi,
      functionName: "symbol",
    })
  }

  async getDecimals() {
    return this.publicClient.readContract({
      address: await this.feeTokenAddress(),
      abi: erc20Abi,
      functionName: "decimals",
    })
  }

  async fetchDetails() {
    return await Promise.all([
      this.getSymbol(),
      this.getDecimals(),
      this.hostParams(),
    ]).then(([symbol, decimals, hostParams]) => {
      return {
        symbol,
        decimals,
        address: hostParams.feeToken,
      }
    })
  }
}
