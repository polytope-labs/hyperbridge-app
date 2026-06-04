import path from "node:path"
import { fileURLToPath, URL } from "node:url"
import hyperbridge from "@hyperbridge/sdk/plugins/vite"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { visualizer } from "rollup-plugin-visualizer"
import { defineConfig } from "vite"
import vercel from "vite-plugin-vercel"
import tsconfigPaths from "vite-tsconfig-paths"

const appSrc = fileURLToPath(new URL("./src", import.meta.url))
const coreSrc = fileURLToPath(new URL("./src/core", import.meta.url))
const sharedSrc = fileURLToPath(new URL("./src/shared", import.meta.url))
const web3ConnectSrc = fileURLToPath(new URL("./src/web3-connect", import.meta.url))

function viteAtRootAliasPlugin({
  appSrc,
  coreSrc,
  sharedSrc,
  web3ConnectSrc,
}: {
  appSrc: string
  coreSrc: string
  sharedSrc: string
  web3ConnectSrc: string
}) {
  return {
    name: "vite-at-root-alias",
    enforce: "pre" as const,
    async resolveId(
      this: import("vite").PluginContext,
      id: string,
      importer: string | undefined,
      options: { ssr?: boolean },
    ) {
      if (!id.startsWith("@/")) return null
      const sub = id.slice(2)
      const normalized = importer?.replaceAll("\\", "/") ?? ""

      const tryResolve = async (base: string) => {
        const candidate = path.resolve(base, sub)
        return this.resolve(candidate, importer, { skipSelf: true, ...options })
      }

      if (normalized.includes("/src/web3-connect/")) {
        return (await tryResolve(web3ConnectSrc)) ?? null
      }
      if (normalized.includes("/src/shared/")) {
        return (await tryResolve(sharedSrc)) ?? null
      }
      if (normalized.includes("/src/core/")) {
        return (await tryResolve(coreSrc)) ?? null
      }
      if (normalized.includes("/src/")) {
        const local = await tryResolve(appSrc)
        if (local) return local
      }
      return (await tryResolve(coreSrc)) ?? null
    },
  }
}

export default defineConfig({
  envDir: ".",
  envPrefix: ["VITE_", "VERCEL_"],
  plugins: [
    viteAtRootAliasPlugin({ appSrc, coreSrc, sharedSrc, web3ConnectSrc }),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    vercel(),
    tailwindcss(),
    tsconfigPaths(),
    hyperbridge(),
    process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: "polytope-labs",
          project: "hyperbridge-v2",
        })
      : null,
    process.env.ANALYZE === "true"
      ? visualizer({
          filename: "dist/stats.html",
          open: false,
          gzipSize: false,
          brotliSize: false,
        })
      : null,
  ].filter(Boolean),
  resolve: {
    alias: [
      { find: "@hyperbridge-fe/shared/constants", replacement: fileURLToPath(new URL("./src/shared/config/constants.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/shared/config", replacement: fileURLToPath(new URL("./src/shared/config/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/shared/types", replacement: fileURLToPath(new URL("./src/shared/types/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/shared/factories", replacement: fileURLToPath(new URL("./src/shared/factories/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/shared/lib", replacement: fileURLToPath(new URL("./src/shared/lib/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/shared", replacement: fileURLToPath(new URL("./src/shared/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/types", replacement: fileURLToPath(new URL("./src/web3-connect/types/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/constants", replacement: fileURLToPath(new URL("./src/web3-connect/constants/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/wallets", replacement: fileURLToPath(new URL("./src/web3-connect/wallets/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/hooks", replacement: fileURLToPath(new URL("./src/web3-connect/hooks/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/helpers", replacement: fileURLToPath(new URL("./src/web3-connect/helpers/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect/store", replacement: fileURLToPath(new URL("./src/web3-connect/store/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/web3-connect", replacement: fileURLToPath(new URL("./src/web3-connect/index.ts", import.meta.url)) },
      { find: "@hyperbridge-fe/app-core", replacement: coreSrc },
      { find: "@abis", replacement: fileURLToPath(new URL("./src/core/abis", import.meta.url)) },
      { find: "@components", replacement: fileURLToPath(new URL("./src/core/components", import.meta.url)) },
      { find: "@types", replacement: fileURLToPath(new URL("./src/core/types", import.meta.url)) },
    ],
    dedupe: ["viem"],
  },
  optimizeDeps: {
    exclude: ["@polkadot/api-augment"],
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 3000,
  },
})
