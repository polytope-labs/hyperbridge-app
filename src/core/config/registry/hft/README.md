# HyperFungibleToken Registry

> **Entry point:** This guide is linked from the [repo root README](../../../../../README.md#adding-a-bridged-token-partners).

This folder is the single source of truth for bridged tokens in the app.
We use [HyperFungibleToken](https://docs.hyperbridge.network/developers/evm/hyper-fungible-token/hyper-fungible-token/) (HFT) for bridge routes.

## Adding a token (partner PRs)

Use the EVM checklist below for HFT / WrappedHFT deployments across EVM chains.
For tokens that originate on a Substrate chain, use the Substrate checklist in
[Substrate-origin tokens](#substrate-origin-tokens). Hyperbridge token routes
use HFT contracts on EVM and `pallet-hft` on Substrate.

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

4. **Ensure EVM networks exist** in `src/shared/config/registry/evm-networks.ts` with correct `ismpHost`, `stateMachineId`, and `featureSupported: ["bridge"]`.
5. **Run tests**: `pnpm test src/shared/config/token-registry`

## Substrate-origin tokens

Substrate to EVM bridging is supported through
[`pallet-hyper-fungible-token`](https://docs.hyperbridge.network/developers/polkadot/hyper-fungible-token/#registering-a-token)
and the EVM `HyperFungibleToken` / `WrappedHyperFungibleToken` contracts. The
token is registered in `pallet-hft` on the Substrate chain, and the peer EVM
contracts must trust that pallet instance.

### Runtime prerequisites

1. Add `pallet-hyper-fungible-token` to the Substrate runtime with pallet name as `HyperFungibleToken`.
2. Configure it with the runtime's ISMP dispatcher, fungible asset implementation, native currency, native asset ID, decimals, and `CreateOrigin`.
3. Register the pallet in the ISMP router so incoming Hyperbridge messages route to `pallet_hyper_fungible_token::Pallet`.
4. Create or confirm the local asset ID in the runtime asset registry before registering it with HFT.

### Register the token in pallet-hft

Call the pallet's `register_token` extrinsic from the configured `CreateOrigin`.
The registration describes the local asset and every remote chain that can
receive it:

```rust
TokenRegistration {
    local_id,
    native,
    chains,
}
```

| Field | Meaning |
|-------|---------|
| `local_id` | Local asset ID in the Substrate runtime's asset registry. |
| `native` | `true` for assets originating on this Substrate chain; `false` for imported/bridged assets. |
| `chains` | Map of destination `StateMachine` values to per-chain HFT configuration. |
| `chains[].token_contract` | Destination module ID. For EVM destinations, use the 20-byte HFT / WrappedHFT contract address. |
| `chains[].decimals` | Destination token decimals, usually `18` for EVM contracts. |

For Substrate-native assets, set `native: true`; sends escrow the local asset in
the pallet custody account. For non-native assets represented on the Substrate
chain, set `native: false`; sends burn the local representation.

### Register the Substrate peer on EVM

Each destination EVM HFT / WrappedHFT contract must register the Substrate pallet
as a trusted peer. Call `addChain` on the EVM contract with the Substrate
state machine and the pallet module ID bytes:

```solidity
token.addChain(
    StateMachine.polkadot(paraId),
    abi.encodePacked(bytes8("pall_hft"))
);
```

The module ID must match the `PALLET_ID` configured by
`pallet-hyper-fungible-token`.

### Add the route to this frontend

1. Add the Substrate source chain to `src/shared/config/registry/substrate-networks.ts` if it is not already present.
2. Ensure each EVM destination exists in `src/shared/config/registry/evm-networks.ts` with `featureSupported: ["bridge"]`.
3. Add the token logo under `public/tokens/` and register the symbol in `src/shared/config/registry/token-images.json`.
4. Add the token to the app token registry for each supported source chain. The Substrate-side entry must include the local `assetId`, token metadata, balance pallet information when required, and `recipientNetworks` pointing at the EVM destinations. The EVM-side entry must include the HFT / WrappedHFT contract address and `recipientNetworks` pointing back at the Substrate source.
5. Run `pnpm test src/shared/config/token-registry`.

The Substrate `assetId` must be the scale-encoded local asset ID registered in
`pallet-hft` with `register_token.local_id`.

### Pallet balances token example

Use `pallet-balances` for a chain's native currency or another balance-backed
asset:

```typescript
{
  type: "substrate",
  name: "Bifrost",
  symbol: "BNC",
  decimals: 12,
  isNative: true,
  existentialDeposit: 1,
  assetId: "0x00000000000000000000000000000000",
  balance: {
    pallet_prefix: "Balances",
    pallet_name: "pallet-balances",
  },
  recipientNetworks: [Ethereum],
}
```

### Pallet assets token example

Use `pallet-assets` when the token is managed by the runtime's Assets pallet:

```typescript
{
  type: "substrate",
  name: "Example Asset",
  symbol: "XAST",
  decimals: 18,
  existentialDeposit: 1,
  assetId: "0x81f0fa02",
  balance: {
    pallet_prefix: "Assets",
    pallet_name: "pallet-assets",
  },
  recipientNetworks: [Ethereum],
}
```

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
