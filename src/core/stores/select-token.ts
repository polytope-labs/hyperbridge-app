import { observable, runInAction } from "mobx"

type SelectToken = {
  show: boolean
  field: "source" | "destination"
}

export interface TokenWithNetwork {
  symbol: string
  address: string
  network: string
  chainId: number
}

class TokenSelectorStore {
  state = observable<SelectToken>({
    show: false,
    field: "source",
  })

  selectToken = () => {
    runInAction(() => {
      this.state.show = true
    })
  }

  toggle = () => {
    runInAction(() => {
      this.state.show = !this.state.show
    })
  }

  close = () => {
    runInAction(() => {
      this.state.show = false
    })
  }
}

export const tokenSelectorStore = new TokenSelectorStore()
