import { approximateFraction } from "../formatting"

it("should approximate numbers", () => {
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })

  const approximate = approximateFraction(formatter)

  expect(approximate(5.48)).toBe("5.48")
  expect(approximate(0.00014)).toBe("~0.00")
  expect(approximate(0.0009)).toBe("~0.001")
  expect(approximate(0.006884432)).toBe("~0.007")
})
