# Hyperbridge Frontend

Standalone Vite + React app for the Hyperbridge bridge product.

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

## HyperFungibleToken registry

Bridging uses [HyperFungibleToken](https://docs.hyperbridge.network/developers/sdk/hyper-fungible-token/). Token definitions live in:

```
src/core/config/registry/hft/
  mainnet.ts   # empty until mainnet launch
  testnet.ts   # WBNB test pair (BSC Testnet ↔ Polygon Amoy)
  README.md    # partner guide for adding tokens via PR
```

**Testnet:** switch to testnet in the app to bridge WBNB between BSC Testnet and Polygon Amoy (matches SDK integration tests).

**Mainnet:** shows an empty state until tokens are added to `mainnet.ts`.

**SDK:** requires `@hyperbridge/sdk` ≥ 2.2.0 for HyperFungibleToken support.

This repo is intentionally **not** a monorepo. HyperFX lives in the separate `hyperbridge-fe` repository.
