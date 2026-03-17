import WebSocket from 'ws'
import crypto from 'crypto'
import type { OKXCandle, OKXTicker, CandleInterval, SupportedPair } from './types'

type MessageHandler = (data: unknown) => void

export interface CandleUpdate {
  type: 'candle'
  instId: string
  bar: CandleInterval
  candle: OKXCandle
}

export interface TickerUpdate {
  type: 'ticker'
  instId: string
  ticker: OKXTicker
}

export type WsUpdate = CandleUpdate | TickerUpdate

export type UpdateHandler = (update: WsUpdate) => void

interface Subscription {
  channel: string
  instId: string
}

const PUBLIC_WS_URL = 'wss://ws.okx.com:8443/ws/v5/public'
const PRIVATE_WS_URL = 'wss://ws.okx.com:8443/ws/v5/private'
const PING_INTERVAL_MS = 25000
const RECONNECT_DELAY_MS = 3000

class OKXWebSocketManager {
  private ws: WebSocket | null = null
  private subscriptions: Subscription[] = []
  private handlers: UpdateHandler[] = []
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnected = false
  private isClosing = false
  private url: string

  constructor(url: string) {
    this.url = url
  }

  private connect() {
    if (this.ws) {
      try { this.ws.terminate() } catch {}
    }

    this.ws = new WebSocket(this.url)

    this.ws.on('open', () => {
      this.isConnected = true
      this.resubscribeAll()
      this.startPing()
    })

    this.ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch {}
    })

    this.ws.on('close', () => {
      this.isConnected = false
      this.stopPing()
      if (!this.isClosing) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', () => {
      this.stopPing()
      if (!this.isClosing) {
        this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY_MS)
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping')
      }
    }, PING_INTERVAL_MS)
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private resubscribeAll() {
    if (this.subscriptions.length === 0) return
    const args = this.subscriptions.map(s => ({
      channel: s.channel,
      instId: s.instId,
    }))
    this.sendJson({ op: 'subscribe', args })
  }

  private sendJson(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (msg.event === 'subscribe' || msg.event === 'unsubscribe') return
    if (msg.event === 'error') return

    const arg = msg.arg as Record<string, string> | undefined
    const data = msg.data as unknown[]
    if (!arg || !data || !Array.isArray(data)) return

    const channel = arg.channel as string
    const instId = arg.instId as string

    if (channel.startsWith('candle')) {
      const bar = channel.replace('candle', '') as CandleInterval
      for (const raw of data) {
        const r = raw as string[]
        const candle: OKXCandle = {
          ts: r[0],
          open: r[1],
          high: r[2],
          low: r[3],
          close: r[4],
          vol: r[5],
          volCcy: r[6] ?? '',
        }
        this.emit({ type: 'candle', instId, bar, candle })
      }
    } else if (channel === 'tickers') {
      for (const raw of data) {
        this.emit({ type: 'ticker', instId, ticker: raw as OKXTicker })
      }
    }
  }

  private emit(update: WsUpdate) {
    for (const h of this.handlers) {
      h(update)
    }
  }

  subscribe(channel: string, instId: string) {
    const exists = this.subscriptions.some(
      s => s.channel === channel && s.instId === instId
    )
    if (exists) return

    this.subscriptions.push({ channel, instId })

    if (!this.isConnected) {
      this.connect()
      return
    }

    this.sendJson({ op: 'subscribe', args: [{ channel, instId }] })
  }

  unsubscribe(channel: string, instId: string) {
    this.subscriptions = this.subscriptions.filter(
      s => !(s.channel === channel && s.instId === instId)
    )
    if (this.isConnected) {
      this.sendJson({ op: 'unsubscribe', args: [{ channel, instId }] })
    }
  }

  onUpdate(handler: UpdateHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  subscribePair(instId: SupportedPair, bar: CandleInterval = '1m') {
    this.subscribe(`candle${bar}`, instId)
    this.subscribe('tickers', instId)
  }

  unsubscribePair(instId: SupportedPair, bar: CandleInterval = '1m') {
    this.unsubscribe(`candle${bar}`, instId)
    this.unsubscribe('tickers', instId)
  }

  close() {
    this.isClosing = true
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.terminate() } catch {}
      this.ws = null
    }
  }
}

let _publicManager: OKXWebSocketManager | null = null

export function getPublicWsManager(): OKXWebSocketManager {
  if (!_publicManager) {
    _publicManager = new OKXWebSocketManager(PUBLIC_WS_URL)
  }
  return _publicManager
}

export { OKXWebSocketManager }
