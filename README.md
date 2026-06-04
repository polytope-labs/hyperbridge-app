# Hyperbridge Frontend

Standalone Vite + React app for the Hyperbridge bridge product.

## Adding a bridged token (partners)

**Want your token in the bridge UI?** Follow the partner guide — do not edit token lists elsewhere.

| | |
|---|---|
| **Full guide** | [`src/core/config/registry/hft/README.md`](./src/core/config/registry/hft/README.md) |
| **Registry files** | `mainnet.ts` / `testnet.ts` in that folder |
| **Docs** | [HyperFungibleToken](https://docs.hyperbridge.network/developers/evm/hyper-fungible-token/hyper-fungible-token/) |
| **SDK** | `@hyperbridge/sdk` ≥ 2.2.0 |

**Quick checklist (details in the guide above):**

1. Deploy HFT / WrappedHFT contracts and register peer chains on-chain.
2. Add logo → `public/tokens/` + `src/shared/config/registry/token-images.json`.
3. Append your token to `mainnet.ts` or `testnet.ts`.
4. Confirm chains exist in `src/shared/config/registry/evm-networks.ts` with `featureSupported: ["bridge"]`.
5. Open a PR and run `pnpm test src/shared/config/token-registry`.

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
