import { NextRequest } from 'next/server'
import { getPublicWsManager } from '@/lib/okx/websocket'
import type { WsUpdate } from '@/lib/okx/websocket'
import type { CandleInterval, SupportedPair } from '@/lib/okx/types'
import { SUPPORTED_PAIRS } from '@/lib/okx/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const instId = (searchParams.get('instId') ?? 'ETH-USDT-SWAP') as SupportedPair
  const bar = (searchParams.get('bar') ?? '1m') as CandleInterval

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const manager = getPublicWsManager()

      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {}
      }

      manager.subscribePair(instId, bar)

      const unsubscribe = manager.onUpdate((update: WsUpdate) => {
        if (update.instId === instId) {
          send(update)
        }
      })

      const cleanup = () => {
        unsubscribe()
      }

      req.signal.addEventListener('abort', cleanup)
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
