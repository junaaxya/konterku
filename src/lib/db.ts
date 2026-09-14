import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"
import { getServerEnv } from "@/lib/env"

let database: PrismaClient | undefined

export function getDatabase(): PrismaClient {
  if (database !== undefined) {
    return database
  }

  const environment = getServerEnv()
  database = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 300_000,
    }),
  })

  return database
}
