import crypto from 'crypto'
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
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

function sign(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secret: string
): string {
  const preHash = timestamp + method.toUpperCase() + path + body
  return crypto.createHmac('sha256', secret).update(preHash).digest('base64')
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

export class OKXClient {
  private http: AxiosInstance
  private config: OKXConfig

  constructor(config: OKXConfig) {
    this.config = config
    this.http = axios.create({ baseURL: BASE_URL, timeout: 10000 })
  }

  private getAuthHeaders(
    method: string,
    path: string,
    body = ''
  ): Record<string, string> {
    const ts = getTimestamp()
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

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const query = params
      ? '?' + new URLSearchParams(params).toString()
      : ''
    const fullPath = path + query
    const headers = this.getAuthHeaders('GET', fullPath)
    const res = await this.http.get<{ code: string; msg: string; data: T }>(
      fullPath,
      { headers }
    )
    if (res.data.code !== '0') {
      throw new Error(`OKX API Error ${res.data.code}: ${res.data.msg}`)
    }
    return res.data.data
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const bodyStr = JSON.stringify(body)
    const headers = this.getAuthHeaders('POST', path, bodyStr)
    const res = await this.http.post<{ code: string; msg: string; data: T }>(
      path,
      body,
      { headers }
    )
    if (res.data.code !== '0') {
      throw new Error(`OKX API Error ${res.data.code}: ${res.data.msg}`)
    }
    return res.data.data
  }

  async getBalance(ccy?: string): Promise<OKXBalance[]> {
    const params: Record<string, string> = {}
    if (ccy) params.ccy = ccy
    const data = await this.get<{ details: OKXBalance[] }[]>(
      '/api/v5/account/balance',
      params
    )
    return data[0]?.details ?? []
  }

  async getPositions(instType?: string, instId?: string): Promise<OKXPosition[]> {
    const params: Record<string, string> = {}
    if (instType) params.instType = instType
    if (instId) params.instId = instId
    return this.get<OKXPosition[]>('/api/v5/account/positions', params)
  }

  async placeOrder(order: OKXOrder): Promise<OKXOrderResponse[]> {
    return this.post<OKXOrderResponse[]>('/api/v5/trade/order', order)
  }

  async cancelOrder(instId: string, ordId: string): Promise<OKXOrderResponse[]> {
    return this.post<OKXOrderResponse[]>('/api/v5/trade/cancel-order', {
      instId,
      ordId,
    })
  }

  async getOpenOrders(instId?: string): Promise<unknown[]> {
    const params: Record<string, string> = {}
    if (instId) params.instId = instId
    return this.get<unknown[]>('/api/v5/trade/orders-pending', params)
  }

  async getHistoricalKlines(
    instId: string,
    bar: CandleInterval = '1m',
    limit = 100
  ): Promise<OKXCandle[]> {
    const raw = await this.get<string[][]>('/api/v5/market/candles', {
      instId,
      bar,
      limit: String(limit),
    })
    return raw.map(([ts, open, high, low, close, vol, volCcy]) => ({
      ts,
      open,
      high,
      low,
      close,
      vol,
      volCcy,
    }))
  }

  async getTicker(instId: string): Promise<OKXTicker> {
    const data = await this.get<OKXTicker[]>('/api/v5/market/ticker', { instId })
    return data[0]
  }

  async setLeverage(
    instId: string,
    lever: string,
    mgnMode: 'cross' | 'isolated',
    posSide?: string
  ): Promise<unknown> {
    const body: Record<string, string> = { instId, lever, mgnMode }
    if (posSide) body.posSide = posSide
    return this.post('/api/v5/account/set-leverage', body)
  }
}

let _client: OKXClient | null = null

export function getOKXClient(): OKXClient {
  if (!_client) {
    const apiKey = process.env.OKX_API_KEY
    const secret = process.env.OKX_SECRET
    const passphrase = process.env.OKX_PASSPHRASE
    if (!apiKey || !secret || !passphrase) {
      throw new Error('OKX credentials not configured. Set OKX_API_KEY, OKX_SECRET, OKX_PASSPHRASE in .env.local')
    }
    _client = new OKXClient({
      apiKey,
      secret,
      passphrase,
      simulated: process.env.OKX_SIMULATED === 'true',
    })
  }
  return _client
}
