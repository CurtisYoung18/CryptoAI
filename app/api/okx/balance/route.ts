import { NextResponse } from 'next/server'
import { getOKXClient } from '@/lib/okx/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = getOKXClient()
    const balances = await client.getBalance()
    return NextResponse.json({ ok: true, data: balances })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
