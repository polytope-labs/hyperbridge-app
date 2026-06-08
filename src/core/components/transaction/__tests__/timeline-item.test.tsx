import { act, render } from "@testing-library/react"
import { addSeconds } from "date-fns/esm/fp"
import addMilliseconds from "date-fns/esm/fp/addMilliseconds/index.js"
import { TTItemCountdown } from "../tx-row"

describe("TTItemCountdown", () => {
  it("should not render countdown when date is past", async () => {
    const now = new Date()
    const countdown_to = addSeconds(-5)(now)

    const { container } = render(<TTItemCountdown date={countdown_to} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("should not render countdown when complete", async () => {
    vi.useFakeTimers()
    const now = new Date()
    const duration = 3_000
    const future = addMilliseconds(duration)(now)

    const { container } = render(<TTItemCountdown date={future} />)

    expect(container).not.toBeEmptyDOMElement()

    await act(() => vi.advanceTimersByTime(duration + 1000))

    expect(container).toBeEmptyDOMElement()
    vi.useRealTimers()
  })
})
