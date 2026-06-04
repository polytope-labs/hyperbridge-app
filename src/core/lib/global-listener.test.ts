import { hash } from "ohash"

it("object hashes are unique", () => {
  const a = hash({
    evm: "0xc4cE6549C5F26de05898AB6E99005f0DBcd0D83a",
    substrate: "5EqsqBNe1LfkGLEah9GpSMWTT4XHzGeVEAZ4dGUm5vFHA4t8",
  })
  const b = hash({
    evm: "",
    substrate: "5EqsqBNe1LfkGLEah9GpSMWTT4XHzGeVEAZ4dGUm5vFHA4t8",
  })

  expect(a).toMatchInlineSnapshot(
    `"ThHWzOXgIRDvXVMqTuNJiD66H5hceH7r0AcnwFsHUxU"`,
  )
  expect(b).toMatchInlineSnapshot(
    `"xFOgXpXFVeFU__s1DyDpdekTo4zB98gIOeGAI8AvZuc"`,
  )
  expect(a).not.toBe(b)
})
