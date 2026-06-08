import { PolkadotBridgeTx } from "../transactions/bridge-polkadot"
import { ReplayTx } from "../tx.helpers"
import TIMEOUT_TRANSACTION from "./timeout-tx.json" assert { type: "json" }
import type { Transaction, TransferTx, TxCreationEvents } from "@/types/tx"

describe("Transform TxErrors", () => {
  describe("XCM", () => {
    it("should transform errors", () => {
      const error = new Error(
        `"Error watching extrinsic: {\"module\":{\"index\":99,\"error\":\"0x11000000\"}}"`,
      )
      // @ts-expect-error Mocking error
      error.module = { index: 99, error: 0x11000000 }

      const error2 = new Error(
        'Error watching extrinsic: {"module":{"index":"99","error":"0x11000000"}}',
      )
      // @ts-expect-error Mocking error
      error2.module = { index: "99", error: "0x11000000" }

      expect(PolkadotBridgeTx.transformTxError(error)).toMatchInlineSnapshot(
        `[Error: Insufficient fee to cover Gas]`,
      )
      expect(PolkadotBridgeTx.transformTxError(error2)).toMatchInlineSnapshot(
        `[Error: Insufficient fee to cover Gas]`,
      )
    })
  })
})

describe("Resumption", () => {
  it("Polkadot -> should replay transaction events from Store", () => {
    const eventEmissionOrder: TxCreationEvents["kind"][] = [
      "InBlock",
      "IPostRequest",
      "Verified",
    ]

    const eventsGenerator = ReplayTx.replayTransaction({
      transaction: NewPolkadotFinalizedTxPayload,
      replayOrder: eventEmissionOrder,
    })

    const events = Array.from(eventsGenerator, (e) => [e.kind, e])
    const eventMap = Object.fromEntries(events)

    expect(events.map((e) => e[0])).toMatchObject(eventEmissionOrder)

    expect(eventMap.InBlock).toMatchInlineSnapshot(`
      {
        "block_number": 3815723,
        "kind": "InBlock",
        "transaction_hash": "0xe9678d68267bfc2a2d18fed993a3d97ad14b8818d95512530c0af4b4fb653d77",
      }
    `)

    expect(eventMap.IPostRequest).toMatchInlineSnapshot(`
      {
        "kind": "IPostRequest",
        "request": {
          "body": "0x000000000000000000000000000000000000000000000000000dcef6ddc217c0009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f00000000000000000000000000000000000000000000000000000000000000007aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a",
          "dest": "EVM-11155111",
          "from": "0xfcda26ca021d5535c3059547390e6ccd8de7aca6",
          "nonce": 1817,
          "source": "KUSAMA-4009",
          "timeoutTimestamp": 1740167328,
          "to": "0xfcda26ca021d5535c3059547390e6ccd8de7aca6",
        },
        "transaction_hash": "0xe9678d68267bfc2a2d18fed993a3d97ad14b8818d95512530c0af4b4fb653d77",
      }
    `)

    expect(eventMap.Verified).toMatchInlineSnapshot(`
      {
        "block_hash": "0x58ef0f215ef67db5965eeda22291bb3fbc9520ce6c46318cdb43ca68114da7cb",
        "block_number": 3815723,
        "kind": "Verified",
        "transaction_hash": "0xe9678d68267bfc2a2d18fed993a3d97ad14b8818d95512530c0af4b4fb653d77",
      }
    `)
  })

  it("EVM -> should replay transaction events from Store", () => {
    const eventEmissionOrder: TxCreationEvents["kind"][] = [
      "InBlock",
      "IPostRequest",
      "Verified",
    ]

    const eventsGenerator = ReplayTx.replayTransaction({
      transaction: LegacyEVM_To_SubstrateTxPayload,
      replayOrder: eventEmissionOrder,
    })

    const events = Array.from(eventsGenerator, (e) => [e.kind, e])
    const eventMap = Object.fromEntries(events)

    expect(events.map((e) => e[0])).toMatchObject(eventEmissionOrder)

    expect(eventMap.InBlock).toMatchInlineSnapshot(`
      {
        "block_number": 48383129,
        "kind": "InBlock",
        "transaction_hash": "0xbcd48fd29f09f29a12bf8e017a4b5bea857c65c57db9b59a82a9a76ce469c01a",
      }
    `)

    expect(eventMap.IPostRequest).toMatchInlineSnapshot(`
      {
        "kind": "IPostRequest",
        "request": {
          "body": "0x000000000000000000000000000000000000000000000000000de0b6b3a7640000ac05b69379f7ac8d594d29d1cc11e6ed5bec3b481c0882bbb1c4fdaa08ba77c60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34",
          "dest": "SUBSTRATE-cere",
          "fee": 0,
          "from": "0xFcDa26cA021d5535C3059547390E6cCd8De7acA6",
          "nonce": 176,
          "source": "EVM-97",
          "timeoutTimestamp": 1739875249,
          "to": "0xa09b1c60e8650245f92518c8a17314878c4043ed",
        },
        "transaction_hash": "0xbcd48fd29f09f29a12bf8e017a4b5bea857c65c57db9b59a82a9a76ce469c01a",
      }
    `)

    expect(eventMap.Verified).toMatchInlineSnapshot(`
      {
        "block_hash": "0xfa23fb80c6bd239231cbdbadbf486ed60557e42ea1002149eca91235683415bd",
        "block_number": 3769695,
        "kind": "Verified",
        "transaction_hash": "0xbcd48fd29f09f29a12bf8e017a4b5bea857c65c57db9b59a82a9a76ce469c01a",
      }
    `)
  })

  it("should replay Timeout events", async () => {
    const stream = ReplayTx.replayTimeout({
      transaction: TIMEOUT_TRANSACTION as unknown as TransferTx,
      manual_completion: true,
      sleepTime: 20,
    })

    const events = await Array.fromAsync(stream)
    expect(
      // @ts-expect-error Mocking events
      events.map((e) => [e.kind, e?.value?.kind ?? ""].join("/")),
    ).toMatchObject([
      "Progress/DestinationFinalized",
      "Progress/HyperbridgeVerified",
      "Progress/HyperbridgeFinalized",
      "Close/",
    ])
  })
})

const NewPolkadotFinalizedTxPayload = {
  transaction_hash:
    "0xe9678d68267bfc2a2d18fed993a3d97ad14b8818d95512530c0af4b4fb653d77",
  protocol: {
    kind: "Transfer",
    amount: 1,
  },
  source: -1,
  destination: 11155111,
  token: {
    name: "Polkadot",
    symbol: "DOT",
    address: "0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114",
    decimals: 18,
    recipientNetworks: [],
    logo: "/tokens/dot.svg",
    __type: "evm",
  },
  relayerFee: 0,
  progress: {
    Dispatched: {
      status: {
        kind: "Dispatched",
        block_number: 3815723,
      },
      timestamp: 1740400532965,
    },
    SourceFinalized: {
      status: {
        kind: "SourceFinalized",
      },
      timestamp: 1740400550698,
    },
    HyperbridgeVerified: {
      status: {
        kind: "HyperbridgeVerified",
        block_hash:
          "0x58ef0f215ef67db5965eeda22291bb3fbc9520ce6c46318cdb43ca68114da7cb",
        block_number: 3815723,
        transaction_hash: "0x",
      },
      timestamp: 1740400550699,
    },
    HyperbridgeFinalized: {
      status: {
        kind: "HyperbridgeFinalized",
      },
      timestamp: 1740401166734,
    },
    DestinationDelivered: {
      status: {
        kind: "DestinationDelivered",
      },
      timestamp: 1740401166734,
    },
  },
  timeoutProgress: {},
  completed: true,
  createdAt: 1740163722508,
  status: "DestinationDelivered",
  inflight: [
    {
      Dispatched: 3815723,
    },
    {
      HyperbridgeVerified: 3815723,
    },
  ],
  timeout: [],
  originalParams: {
    source: -1,
    destination: 11155111,
    amount: 1,
    timeout: 3600,
    recipient: "0xc4cE6549C5F26de05898AB6E99005f0DBcd0D83a",
    relayerFee: 0,
    token: {
      name: "Polkadot",
      symbol: "DOT",
      address: "0xbedad6dfbc5e8cc3bc1ea0221b2a10118507b114",
      decimals: 18,
      recipientNetworks: [],
      logo: "/tokens/dot.svg",
      __type: "evm",
    },
    from: "5EqsqBNe1LfkGLEah9GpSMWTT4XHzGeVEAZ4dGUm5vFHA4t8",
  },
  meta: [
    {
      type: "resumption_params",
      nonce: "0",
      transaction_hash:
        "0xe9678d68267bfc2a2d18fed993a3d97ad14b8818d95512530c0af4b4fb653d77",
      hyperbridge_block: 3815720,
    },
  ],
  request: {
    body: "0x000000000000000000000000000000000000000000000000000dcef6ddc217c0009bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f00000000000000000000000000000000000000000000000000000000000000007aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a",
    dest: "EVM-11155111",
    from: "0xfcda26ca021d5535c3059547390e6ccd8de7aca6",
    nonce: 1817,
    source: "KUSAMA-4009",
    timeoutTimestamp: 1740167328,
    to: "0xfcda26ca021d5535c3059547390e6ccd8de7aca6",
  },
} as unknown as Transaction

const LegacyEVM_To_SubstrateTxPayload = {
  transaction_hash:
    "0xbcd48fd29f09f29a12bf8e017a4b5bea857c65c57db9b59a82a9a76ce469c01a",
  protocol: {
    kind: "Transfer",
    amount: 1,
  },
  source: 97,
  destination: "SUBSTRATE-cere",
  token: {
    name: "Cere",
    symbol: "CERE",
    address: "0xf310641B4B6c032D0c88d72d712C020fCa9805A3",
    decimals: 18,
    recipientNetworks: [
      {
        group: "substrate",
        name: "Cere Testnet",
        logo: "/networks/cere.svg",
        networkType: "testnet",
        chainId: "SUBSTRATE-cere",
        consensus: {
          layer: "Cere",
          stateId: "CERE",
        },
        rpcUrls: ["wss://archive.testnet.cere.network/ws"],
        estimatedTransferTime: "10.4 minute",
        transaction: {
          url: "#/[txHash]",
        },
      },
    ],
    logo: "/networks/cere.svg",
    __type: "evm",
  },
  relayerFee: 0,
  progress: {
    Dispatched: {
      status: {
        kind: "Dispatched",
        block_number: 48383129,
        commitment:
          "0xa3498455fae6f14c999ea1a7950c9b57da7df2df56a28d9104a755567373c7c0",
      },
      timestamp: 1739871652668,
    },
    SourceFinalized: {
      status: {
        kind: "SourceFinalized",
        finalized_height: 48383131,
        block_hash:
          "0x6e6be93a6ef378651e0fc73a70aa763ca945b535e28a157e86dad0e548ca60db",
        transaction_hash:
          "0x298983ecac3cda45400147ca104d373b80067a0cfd38bcf026d59f5b3f142c5c",
        block_number: 3769688,
      },
      timestamp: 1739871687425,
    },
    HyperbridgeVerified: {
      status: {
        kind: "HyperbridgeVerified",
        block_hash:
          "0xfa23fb80c6bd239231cbdbadbf486ed60557e42ea1002149eca91235683415bd",
        transaction_hash:
          "0x37d40ddfc35ade5fe38d9d844d6f9971bf39481d1dccb0dca60d47e28491e904",
        block_number: 3769695,
      },
      timestamp: 1739871717798,
    },
    HyperbridgeFinalized: {
      status: {
        kind: "HyperbridgeFinalized",
      },
      timestamp: 1739872131712,
    },
    DestinationDelivered: {
      status: {
        kind: "DestinationDelivered",
      },
      timestamp: 1739872131713,
    },
  },
  timeoutProgress: {},
  completed: true,
  createdAt: 1739871646605,
  status: "DestinationDelivered",
  inflight: [
    {
      Dispatched: 48383129,
    },
    {
      SourceFinalized: 48383131,
    },
    {
      HyperbridgeVerified: 3769695,
    },
  ],
  timeout: [],
  request: {
    from: "0xFcDa26cA021d5535C3059547390E6cCd8De7acA6",
    source: "EVM-97",
    dest: "SUBSTRATE-cere",
    to: "0xa09b1c60e8650245f92518c8a17314878c4043ed",
    nonce: 176,
    timeoutTimestamp: 1739875249,
    body: "0x000000000000000000000000000000000000000000000000000de0b6b3a7640000ac05b69379f7ac8d594d29d1cc11e6ed5bec3b481c0882bbb1c4fdaa08ba77c60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4ce6549c5f26de05898ab6e99005f0dbcd0d83a7aec163072f2e144b16f8a27a7ef164080577f3d4f1c8914de44768dd227ff34",
    fee: 0,
  },
} as unknown as Transaction
