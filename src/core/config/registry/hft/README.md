# HyperFungibleToken Registry

This folder is the single source of truth for bridged tokens in the app.
We use [HyperFungibleToken](https://docs.hyperbridge.network/developers/evm/hyper-fungible-token/hyper-fungible-token/) (HFT) for bridge routes.

## Adding a token (partner PRs)

1. **Deploy contracts** on each chain (WrappedHFT on home chain, HFT on remote chains) and register peer chains on-chain.
2. **Add a logo** under `public/tokens/` and register the symbol in `src/shared/config/registry/token-images.json`.
3. **Append an entry** to the environment file:
   - Mainnet → `mainnet.ts`
   - Testnet → `testnet.ts`

### Example

```typescript
{
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  defaultRelayerFee: "5",   // fee tokens; adjust per route
  defaultTimeout: 7200,     // seconds (2 hours)
  deployments: [
    {
      chainId: Ethereum.chainId,
      address: "0x...",     // WrappedHFT on home chain
      type: "wrapped-hft",
      underlying: "0x...",  // canonical ERC20
    },
    {
      chainId: Base.chainId,
      address: "0x...",     // HFT on remote chain
      type: "hft",
    },
  ],
}
```

Each deployment lists every other deployment as a bridge destination automatically — no need to maintain `recipientNetworks` manually.

4. **Ensure networks exist** in `src/shared/config/registry/evm-networks.ts` with correct `ismpHost`, `stateMachineId`, and `featureSupported: ["bridge"]`.
5. **Run tests**: `pnpm test src/shared/config/token-registry`

## Architecture

| File | Purpose |
|------|---------|
| `types.ts` | `HftTokenDefinition` schema |
| `mainnet.ts` | Mainnet tokens (empty until launch) |
| `testnet.ts` | Testnet tokens |
| `build-registry.ts` | Converts definitions → `ChainTokenRegistry` |
| `index.ts` | Exports `MainAssetRegistry` / `TestAssetRegistry` |

## Testnet reference

The WBNB test pair matches the SDK integration tests:

- BSC Testnet WrappedHFT: `0x56a77F44a08cf357F59Cc3ae3de7aDfDFaa973d8`
- Polygon Amoy HFT: `0xa0D8d6E104b92113c7E2815e970cb5626270E8c1`
- ISMP Host (both chains): `0xEB944071A9Bf22810757C5BcFf7a2aE9663a311D`
- Token Faucet: `0xcb00f5b86aac5e2fdca9dc7f34d9bfe00b967c18`
