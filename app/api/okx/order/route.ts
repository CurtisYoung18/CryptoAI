import { NextRequest, NextResponse } from 'next/server'
import { getOKXClient } from '@/lib/okx/client'
import type { OKXOrder } from '@/lib/okx/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ...rest } = body

    const client = getOKXClient()

    if (action === 'cancel') {
      const { instId, ordId } = rest
      const result = await client.cancelOrder(instId, ordId)
      return NextResponse.json({ ok: true, data: result })
    }

    const order = rest as OKXOrder
    const result = await client.placeOrder(order)
    return NextResponse.json({ ok: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const instId = searchParams.get('instId') ?? undefined
    const client = getOKXClient()
    const orders = await client.getOpenOrders(instId)
    return NextResponse.json({ ok: true, data: orders })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
