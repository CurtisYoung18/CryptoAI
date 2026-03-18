import crypto from 'crypto'
import type {
  OKXConfig,
  OKXBalance,
  OKXPosition,
  OKXOrder,
  OKXOrderResponse,
  OKXCandle,
  OKXTicker,
  CandleInterval,
} from './types'

const BASE_URL = 'https://www.okx.com'

function sign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const preHash = timestamp + method.toUpperCase() + path + body
  return crypto.createHmac('sha256', secret).update(preHash).digest('base64')
}

export class OKXClient {
  private config: OKXConfig

  constructor(config: OKXConfig) {
    this.config = config
  }

  private getAuthHeaders(method: string, path: string, body = ''): Record<string, string> {
    const ts = new Date().toISOString()
    const sig = sign(ts, method, path, body, this.config.secret)
    return {
      'OK-ACCESS-KEY': this.config.apiKey,
      'OK-ACCESS-SIGN': sig,
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': this.config.passphrase,
      'Content-Type': 'application/json',
      ...(this.config.simulated ? { 'x-simulated-trading': '1' } : {}),
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : ''
    const headers = this.getAuthHeaders(method, path, bodyStr)

    const res = await fetch(BASE_URL + path, {
      method,
      headers,
      ...(body !== undefined ? { body: bodyStr } : {}),
      cache: 'no-store',
    })

    const json = await res.json() as { code: string; msg: string; data: T }

    if (!res.ok || json.code !== '0') {
      throw new Error(`OKX ${res.status} [${json.code}]: ${json.msg}`)
    }
    return json.data
  }

  async getBalance(ccy?: string): Promise<OKXBalance[]> {
    const qs = ccy ? `?ccy=${ccy}` : ''
    const data = await this.request<{ details: OKXBalance[] }[]>('GET', `/api/v5/account/balance${qs}`)
    return data[0]?.details ?? []
  }

  async getPositions(instType?: string, instId?: string): Promise<OKXPosition[]> {
    const params = new URLSearchParams()
    if (instType) params.set('instType', instType)
    if (instId) params.set('instId', instId)
    const qs = params.toString() ? `?${params}` : ''
    return this.request<OKXPosition[]>('GET', `/api/v5/account/positions${qs}`)
  }

  async placeOrder(order: OKXOrder): Promise<OKXOrderResponse[]> {
    return this.request<OKXOrderResponse[]>('POST', '/api/v5/trade/order', order)
  }

  async cancelOrder(instId: string, ordId: string): Promise<OKXOrderResponse[]> {
    return this.request<OKXOrderResponse[]>('POST', '/api/v5/trade/cancel-order', { instId, ordId })
  }

  async getOpenOrders(instId?: string): Promise<unknown[]> {
    const qs = instId ? `?instId=${instId}` : ''
    return this.request<unknown[]>('GET', `/api/v5/trade/orders-pending${qs}`)
  }

  async getHistoricalKlines(instId: string, bar: CandleInterval = '1m', limit = 100): Promise<OKXCandle[]> {
    const qs = `?instId=${instId}&bar=${bar}&limit=${limit}`
    const raw = await this.request<string[][]>('GET', `/api/v5/market/candles${qs}`)
    return raw.map(([ts, open, high, low, close, vol, volCcy]) => ({
      ts, open, high, low, close, vol, volCcy,
    }))
  }

  async getTicker(instId: string): Promise<OKXTicker> {
    const data = await this.request<OKXTicker[]>('GET', `/api/v5/market/ticker?instId=${instId}`)
    return data[0]
  }

  async setLeverage(instId: string, lever: string, mgnMode: 'cross' | 'isolated', posSide?: string): Promise<unknown> {
    const body: Record<string, string> = { instId, lever, mgnMode }
    if (posSide) body.posSide = posSide
    return this.request('POST', '/api/v5/account/set-leverage', body)
  }
}

export function getOKXClient(): OKXClient {
  const apiKey = process.env.OKX_API_KEY
  const secret = process.env.OKX_SECRET
  const passphrase = process.env.OKX_PASSPHRASE
  if (!apiKey || !secret || !passphrase) {
    throw new Error('OKX credentials not configured. Set OKX_API_KEY, OKX_SECRET, OKX_PASSPHRASE in .env.local')
  }
  return new OKXClient({
    apiKey,
    secret,
    passphrase,
    simulated: process.env.OKX_SIMULATED === 'true',
  })
}
