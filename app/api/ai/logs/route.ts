import { NextRequest } from 'next/server'
import { getStrategyRunner } from '@/lib/strategy/runner'
import type { RunnerLog } from '@/lib/strategy/runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const runner = getStrategyRunner()

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Send current logs immediately
      send({ type: 'init', logs: runner.getLogs(), config: runner.getConfig(), running: runner.isRunning() })

      const unsubscribe = runner.onLog((log: RunnerLog) => {
        send({ type: 'log', log })
      })

      req.signal.addEventListener('abort', () => {
        unsubscribe()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
