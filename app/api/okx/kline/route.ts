import { NextRequest, NextResponse } from 'next/server'
import { getOKXClient } from '@/lib/okx/client'
import type { CandleInterval } from '@/lib/okx/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const instId = searchParams.get('instId') ?? 'ETH-USDT-SWAP'
    const bar = (searchParams.get('bar') ?? '1m') as CandleInterval
    const limit = Number(searchParams.get('limit') ?? '200')

    const client = getOKXClient()
    const candles = await client.getHistoricalKlines(instId, bar, limit)
    return NextResponse.json({ ok: true, data: candles })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
