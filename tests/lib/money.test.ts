import { describe, expect, it } from "vitest"

import { formatRupiah } from "../../src/lib/money"

describe("formatRupiah", () => {
  it("formats exact bigint Rupiah with Indonesian currency conventions", () => {
    // Given: a Rupiah amount beyond JavaScript's safe number range.
    const amount = 9_007_199_254_740_993n

    // When: amount is formatted for display.
    const formattedAmount = formatRupiah(amount)

    // Then: every Rupiah digit remains in Indonesian currency output.
    expect(formattedAmount).toBe("Rp 9.007.199.254.740.993")
  })
})
