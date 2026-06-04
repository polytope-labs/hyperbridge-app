import { TimelineStructure } from "../timeline-event-transformer"

const { group_to_list, list_to_tree } = TimelineStructure

describe("Timeline Grouping", () => {
  const group_items = () =>
    group_to_list([
      "send/Dispatched",
      "send/SourceFinalized",
      "send/HyperbridgeVerified",
      "send/HyperbridgeFinalized",
      "send/DestinationDelivered",
    ])

  it("should be a list", () => {
    const item = Array.from(group_items())

    expect(item).toMatchInlineSnapshot(`
      [
        [
          0,
          "send/Dispatched",
        ],
        [
          1,
          "send/SourceFinalized",
        ],
        [
          1,
          "send/HyperbridgeVerified",
        ],
        [
          1,
          "send/HyperbridgeFinalized",
        ],
        [
          0,
          "send/DestinationDelivered",
        ],
      ]
    `)
  })

  it("should be a tree", () => {
    const items = list_to_tree(group_items())

    expect(Array.from(items)).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "children": [],
              "key": "send/SourceFinalized",
            },
            {
              "children": [],
              "key": "send/HyperbridgeVerified",
            },
            {
              "children": [],
              "key": "send/HyperbridgeFinalized",
            },
          ],
          "key": "send/Dispatched",
        },
        {
          "children": [],
          "key": "send/DestinationDelivered",
        },
      ]
    `)
  })
})
