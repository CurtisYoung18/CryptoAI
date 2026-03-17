import { NextRequest, NextResponse } from 'next/server'
import { getStrategyRunner } from '@/lib/strategy/runner'

export const dynamic = 'force-dynamic'

export async function GET() {
  const runner = getStrategyRunner()
  return NextResponse.json({
    ok: true,
    data: {
      config: runner.getConfig(),
      running: runner.isRunning(),
      logs: runner.getLogs(),
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const runner = getStrategyRunner()
    runner.updateConfig(body)
    return NextResponse.json({
      ok: true,
      data: {
        config: runner.getConfig(),
        running: runner.isRunning(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
