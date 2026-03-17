import { NextRequest, NextResponse } from 'next/server'
import { getOKXClient } from '@/lib/okx/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const instType = searchParams.get('instType') ?? undefined
    const instId = searchParams.get('instId') ?? undefined
    const client = getOKXClient()
    const positions = await client.getPositions(instType, instId)
    return NextResponse.json({ ok: true, data: positions })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
