import { z } from "zod"

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use PostgreSQL protocol",
  )

const serverEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

type ServerEnvInput = Readonly<Record<string, string | undefined>>

export function parseServerEnv(input: ServerEnvInput): ServerEnv {
  return serverEnvSchema.parse(input)
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env)
}
