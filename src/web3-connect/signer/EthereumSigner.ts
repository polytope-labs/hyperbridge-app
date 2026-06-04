import {
  type JsonRpcSigner,
  type TransactionRequest,
  Web3Provider,
} from "@ethersproject/providers"
import type UniversalProvider from "@walletconnect/universal-provider"
import type { BigNumber } from "ethers"
import {
  isEthereumProvider,
  type MetaMaskLikeProvider,
  requestNetworkSwitch,
} from "@/helpers/metamask"

type EthereumProvider = MetaMaskLikeProvider | UniversalProvider

export class EthereumSigner {
  address: string
  provider: EthereumProvider
  signer: JsonRpcSigner

  constructor(address: string, provider: EthereumProvider) {
    this.address = address
    this.provider = provider
    this.signer = this.getSigner(provider)
  }

  getSigner(provider: EthereumProvider) {
    return new Web3Provider(provider).getSigner()
  }

  setAddress(address: string) {
    this.address = address
  }

  async getGasValues(tx: TransactionRequest): Promise<{
    gas: BigNumber
    gasPrice: BigNumber
    maxPriorityFeePerGas: BigNumber
    maxFeePerGas: BigNumber
  }> {
    const [gas, gasPrice] = await Promise.all([
      this.signer.provider.estimateGas(tx),
      this.signer.provider.getGasPrice(),
    ])

    const onePrc = gasPrice.div(100)
    const gasPricePlus = gasPrice.add(onePrc)

    return {
      gas,
      gasPrice,
      maxPriorityFeePerGas: gasPricePlus,
      maxFeePerGas: gasPricePlus,
    }
  }

  requestNetworkSwitch = async (chain: string) => {
    if (isEthereumProvider(this.provider)) {
      await requestNetworkSwitch(this.provider, {
        chain,
        onSwitch: () => {
          // update signer after network switch
          this.signer = this.getSigner(this.provider)
        },
      })
    }
  }

  sendTransaction = async (
    transaction: TransactionRequest & { chain?: string },
  ) => {
    const { chain, ...tx } = transaction
    await this.requestNetworkSwitch(String(chain))

    return await this.signer.sendTransaction({
      ...tx,
    })
  }
}
