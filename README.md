# Hyperbridge Frontend

Standalone Vite + React app for the Hyperbridge bridge product.

## Adding a bridged token (partners)

**Want your token in the bridge UI?** Follow the partner guide — do not edit token lists elsewhere.

| | |
|---|---|
| **Full guide** | [`src/core/config/registry/hft/README.md`](./src/core/config/registry/hft/README.md) |
| **Registry files** | `mainnet.ts` / `testnet.ts` in that folder |
| **EVM HFT docs** | [HyperFungibleToken](https://docs.hyperbridge.network/developers/evm/hyper-fungible-token/hyper-fungible-token/) |
| **Substrate HFT docs** | [Pallet Hyper Fungible Token](https://docs.hyperbridge.network/developers/polkadot/hyper-fungible-token/#registering-a-token) |
| **SDK** | `@hyperbridge/sdk` ≥ 2.2.0 |

**EVM HFT checklist (details in the guide above):**

1. Deploy HFT / WrappedHFT contracts and register peer chains on-chain.
2. Add logo → `public/tokens/` + `src/shared/config/registry/token-images.json`.
3. Append your token to `mainnet.ts` or `testnet.ts`.
4. Confirm chains exist in `src/shared/config/registry/evm-networks.ts` with `featureSupported: ["bridge"]`.
5. Open a PR and run `pnpm test src/shared/config/token-registry`.

**Substrate HFT checklist:**

1. Make sure the source chain has `pallet-hyper-fungible-token` wired into its runtime and ISMP router.
2. Create or confirm the local asset ID in the chain's asset registry.
3. Register the token in `pallet-hft` with `register_token`, including the destination EVM HFT / WrappedHFT contract address and decimals.
4. On each EVM HFT / WrappedHFT contract, register the Substrate pallet as a trusted peer with `addChain`.
5. Add the token to this app registry, make sure the Substrate source exists in `src/shared/config/registry/substrate-networks.ts`, and make sure each EVM destination has `featureSupported: ["bridge"]` in `src/shared/config/registry/evm-networks.ts`.

## Setup

```bash
pnpm install
cp .env.example .env.local
# Fill in VITE_* values in .env.local
```

## Scripts

```bash
pnpm dev          # local dev server
pnpm build        # production build → dist/
pnpm preview      # preview production build
pnpm type-check   # TypeScript check
pnpm test         # unit tests
```

## Structure

```
src/
  components/     # Bridge UI (forms, navigation)
  pages/          # Bridge routes
  stores/         # Bridge transfer state
  core/           # Shared app logic (inlined from former app-core package)
  shared/         # Network/token config (inlined from former shared package)
  web3-connect/   # Wallet connection (inlined from former web3-connect package)
```

### HFT token registry

Partner token definitions live under `src/core/config/registry/hft/`. See **[Adding a bridged token (partners)](#adding-a-bridged-token-partners)** at the top of this file.
