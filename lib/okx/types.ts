export type TradingMode = 'ai' | 'manual' | 'hybrid'

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'
export type PositionSide = 'long' | 'short' | 'net'
export type InstrumentType = 'SPOT' | 'SWAP' | 'FUTURES' | 'OPTION'

export interface OKXConfig {
  apiKey: string
  secret: string
  passphrase: string
  simulated?: boolean
}

export interface OKXBalance {
  ccy: string
  availBal: string
  frozenBal: string
  bal: string
  usdVal: string
}

export interface OKXPosition {
  instId: string
  instType: string
  posSide: PositionSide
  pos: string
  avgPx: string
  upl: string
  uplRatio: string
  lever: string
  liqPx: string
  markPx: string
  margin: string
  cTime: string
  uTime: string
}

export interface OKXOrder {
  instId: string
  tdMode: string
  side: OrderSide
  posSide?: PositionSide
  ordType: OrderType
  sz: string
  px?: string
  tpTriggerPx?: string
  slTriggerPx?: string
  tpOrdPx?: string
  slOrdPx?: string
  lever?: string
}

export interface OKXOrderResponse {
  ordId: string
  clOrdId: string
  sCode: string
  sMsg: string
}

export interface OKXCandle {
  ts: string
  open: string
  high: string
  low: string
  close: string
  vol: string
  volCcy: string
}

export interface OKXTicker {
  instId: string
  last: string
  lastSz: string
  askPx: string
  askSz: string
  bidPx: string
  bidSz: string
  open24h: string
  high24h: string
  low24h: string
  volCcy24h: string
  vol24h: string
  ts: string
}

export type CandleInterval =
  | '1s'
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1H'
  | '2H'
  | '4H'
  | '6H'
  | '12H'
  | '1D'
  | '1W'
  | '1M'

export const SUPPORTED_PAIRS = [
  'ETH-USDT-SWAP',
  'BTC-USDT-SWAP',
  'ETH-USDT',
  'BTC-USDT',
] as const

export type SupportedPair = (typeof SUPPORTED_PAIRS)[number]
