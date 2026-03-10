import { describe, expect, it } from "vitest"

import { sanitizeNextPath } from "./navigation"


describe("sanitizeNextPath", () => {
  it("keeps safe relative paths", () => {
    expect(sanitizeNextPath("/watchlist")).toBe("/watchlist")
    expect(sanitizeNextPath("/portfolio?tab=summary")).toBe("/portfolio?tab=summary")
  })

  it("falls back to the landing page for unsafe values", () => {
    expect(sanitizeNextPath(null)).toBe("/")
    expect(sanitizeNextPath("https://evil.com")).toBe("/")
    expect(sanitizeNextPath("//evil.com")).toBe("/")
    expect(sanitizeNextPath("watchlist")).toBe("/")
  })
})
