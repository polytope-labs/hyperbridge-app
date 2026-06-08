import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"
import * as matchers from "@testing-library/jest-dom/matchers"
import { cleanup } from "@testing-library/react"
import { afterEach, expect } from "vitest"

expect.extend(matchers)

afterEach(() => {
  cleanup()
})

// added because of @wallet-connect/modal dependency
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

declare module "vitest" {
  interface Assertion<T> extends TestingLibraryMatchers<T, void> {
    readonly add_to_shut_eslint_error: unknown
  }
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, void> {
    readonly add_to_shut_eslint_error: unknown
  }
}
