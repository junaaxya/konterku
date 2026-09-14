import { describe, expect, it } from "vitest"

import { parseServerEnv } from "../../src/lib/env"

describe("parseServerEnv", () => {
  it("returns DATABASE_URL when value is a PostgreSQL URL", () => {
    // Given: a configured PostgreSQL connection URL.
    const databaseUrl = "postgresql://konterku:secret@db:5432/konterku?schema=public"

    // When: server environment is parsed.
    const environment = parseServerEnv({ DATABASE_URL: databaseUrl })

    // Then: validated URL is returned.
    expect(environment.DATABASE_URL).toBe(databaseUrl)
  })

  it("rejects a missing DATABASE_URL", () => {
    // Given: no database connection URL.
    const environment = {}

    // When / Then: environment parsing rejects startup configuration.
    expect(() => parseServerEnv(environment)).toThrow("DATABASE_URL")
  })

  it("rejects a non-PostgreSQL DATABASE_URL", () => {
    // Given: a URL for another database type.
    const environment = { DATABASE_URL: "mysql://konterku:secret@db:3306/konterku" }

    // When / Then: environment parsing rejects unsupported database configuration.
    expect(() => parseServerEnv(environment)).toThrow("PostgreSQL")
  })
})
