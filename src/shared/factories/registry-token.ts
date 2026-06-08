import type { ChainId, RegistryToken } from "@/types"

export const RegistryTokenImpl = {
  entry(
    chainId: ChainId,
    entries: RegistryToken[],
  ): [typeof chainId, typeof entries] {
    return [chainId, entries]
  },

  entriesToObject(
    entries: Array<[ChainId, RegistryToken[]]>,
  ): Record<ChainId, RegistryToken[]> {
    return Object.fromEntries(entries)
  },
}
