import { NextResponse } from 'next/server'
import { getStrategyRunner } from '@/lib/strategy/runner'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const runner = getStrategyRunner()
    if (!runner.isRunning()) {
      return NextResponse.json({ ok: false, error: 'Runner not active' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      data: { logs: runner.getLogs() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
