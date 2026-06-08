import { TxEventImpl } from "../tx-event"

describe("convert IndexerEvent -> TxEvent", () => {
  describe("Relay source", () => {
    it("relay handles DESTINATION", () => {
      const indexer_statuses = [
        {
          metadata: {
            blockHash:
              "0xe5f03fab1300a7b4c853b4ef01403d1e18508b46b7eefbdb4af3d5a2078aff99",
            blockNumber: 4245196,
            transactionHash: "",
          },
          status: "SOURCE",
        },
        {
          metadata: {
            blockHash:
              "0xcbc31a61baf5efb0906b2915a4697a36d351e25c482a1886f1eadbd6a4815c4c",
            blockNumber: 49395837,
            transactionHash:
              "0x7e21ae26ac1e980909a82c0711cca218958d63c0eac9bdd8f403872b3ef32c06",
          },
          status: "DESTINATION",
        },
      ] as const

      const response = indexer_statuses.map((event) => {
        return TxEventImpl.normalize("relay", event)
      })

      expect(response).toMatchInlineSnapshot(`
        [
          {
            "__path": "send",
            "__tag": "TxEvent",
            "block_hash": "0xe5f03fab1300a7b4c853b4ef01403d1e18508b46b7eefbdb4af3d5a2078aff99",
            "block_number": 4245196,
            "kind": "HyperbridgeVerified",
            "transaction_hash": "",
          },
          {
            "__path": "send",
            "__tag": "TxEvent",
            "block_hash": "0xcbc31a61baf5efb0906b2915a4697a36d351e25c482a1886f1eadbd6a4815c4c",
            "block_number": 49395837,
            "kind": "DestinationDelivered",
            "transaction_hash": "0x7e21ae26ac1e980909a82c0711cca218958d63c0eac9bdd8f403872b3ef32c06",
          },
        ]
      `)
    })
  })
})
