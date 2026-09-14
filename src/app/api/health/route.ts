import { getDatabase } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    await getDatabase().$queryRaw`SELECT 1`
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ status: "error" }, { status: 503 })
    }

    throw error
  }

  return Response.json({ status: "ok" })
}
