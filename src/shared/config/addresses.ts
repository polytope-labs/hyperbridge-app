import type { Address } from "viem"

type AddressMap = {
  inscriptions: Address
  tokenFaucet: Address
  tokenSaleEvm: Address
  tokenSalePolkadot: Address
  dotAddress: Address
  dispatcherAddress: Address
}

export const mainnetAddresses: AddressMap = {
  inscriptions: "0x9251C6B5f4e2CEE34269400CBB43AD5C813606F6",
  tokenFaucet: "0x",
  tokenSaleEvm: "0x08BcC96ceC579Ce2eDb34E5C5d790e4A40c3e224",
  tokenSalePolkadot:
    "0x557809a870de383fa9421e47d9be561c1da99a6d144a0d8f7778f7bc0d9efc03",
  dotAddress: "0x8d010bf9C26881788b4e6bf5Fd1bdC358c8F90b8",
  dispatcherAddress: "0xE2C7e576E26E0bE7aC97c6fE925bcDAbD87c4bEd",
}

export const testnetAddresses: AddressMap = {
  inscriptions: "0xA617376Ff771DBE264a8CFe9653B35Ca93c01435",
  tokenFaucet: "0xcb00f5b86aac5e2fdca9dc7f34d9bfe00b967c18",
  tokenSaleEvm: "0xd7d832DEBfE33dBa56C99C3343105d64EDe9b6A1",
  tokenSalePolkadot:
    "0x270dd464f83113c80c26de91e0fe75b56f02eca13cbfd778b850cc8278d2aa2d",
  dotAddress: "0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114",
  dispatcherAddress: "0x2b332088275bc9e3c26d81b2975de2483320c181",
}
