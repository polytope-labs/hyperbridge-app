import { createStorage, defineDriver } from "unstorage"
import localStorageDriver from "unstorage/drivers/localstorage"

const isSSR = () => typeof window === "undefined"

const sessionStub = defineDriver(() => ({
  async getItem(_key: string) {
    return null
  },
  async hasItem(_key: string) {
    return false
  },
  async getKeys() {
    return []
  },
  async removeItem(_key: string) {},
  async setItem(_key: string, _value: string) {},
  async clear() {},
}))

export const local_storage = createStorage({
  driver: isSSR()
    ? sessionStub({})
    : localStorageDriver({ base: "hyperbridge:" }),
})
