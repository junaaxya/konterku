import { NextResponse } from "next/server"
import { ingestMobileBridgeBalance } from "@/features/accounts/local-bank-connectors/connector-service"
import { ZodError } from "zod"

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("x-connector-token")
    const body = await request.json()
    const result = await ingestMobileBridgeBalance(body, authHeader)

    if (!result.success) {
      const isAuthError = result.error?.includes("Token pairing")
      return NextResponse.json(
        { success: false, error: result.error },
        { status: isAuthError ? 401 : 400 },
      )
    }

    return NextResponse.json({
      success: true,
      snapshotId: result.snapshotId,
      balance: result.balance?.toString(),
      observedAt: result.observedAt?.toISOString(),
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload konektor tidak valid. Periksa format data saldo dan nomor rekening.",
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memproses sinkronisasi saldo dari konektor mobile.",
      },
      { status: 500 },
    )
  }
}
