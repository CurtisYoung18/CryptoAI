'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { CandleInterval, SupportedPair } from '@/lib/okx/types'
import { useTradingStore } from '@/store/trading'

interface KLineChartProps {
  instId: SupportedPair
  bar: CandleInterval
  onPairChange?: (pair: SupportedPair) => void
  onBarChange?: (bar: CandleInterval) => void
}

const PAIRS: SupportedPair[] = ['ETH-USDT-SWAP', 'BTC-USDT-SWAP', 'ETH-USDT', 'BTC-USDT']
const BARS: CandleInterval[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D']

export default function KLineChart({ instId, bar, onPairChange, onBarChange }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const tickers = useTradingStore((s) => s.tickers)
  const updateTicker = useTradingStore((s) => s.updateTicker)

  const ticker = tickers[instId]

  const initChart = useCallback(() => {
    if (!containerRef.current) return
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: bar === '1m' || bar === '5m',
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [bar])

  const loadHistorical = useCallback(async () => {
    try {
      const res = await fetch(`/api/okx/kline?instId=${instId}&bar=${bar}&limit=200`)
      const json = await res.json()
      if (!json.ok || !seriesRef.current) return

      const data: CandlestickData[] = json.data
        .map((c: { ts: string; open: string; high: string; low: string; close: string }) => ({
          time: (Math.floor(Number(c.ts) / 1000)) as Time,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }))
        .sort((a: CandlestickData, b: CandlestickData) => (a.time as number) - (b.time as number))

      seriesRef.current.setData(data)
      chartRef.current?.timeScale().fitContent()
    } catch {}
  }, [instId, bar])

  useEffect(() => {
    const cleanup = initChart()
    loadHistorical()
    return cleanup
  }, [initChart, loadHistorical])

  useEffect(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const es = new EventSource(`/api/stream?instId=${instId}&bar=${bar}`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data)

        if (update.type === 'candle' && update.bar === bar && update.instId === instId) {
          const c = update.candle
          const point: CandlestickData = {
            time: (Math.floor(Number(c.ts) / 1000)) as Time,
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
          }
          seriesRef.current?.update(point)
        }

        if (update.type === 'ticker' && update.instId === instId) {
          const t = update.ticker
          const prev = parseFloat(t.open24h || '0')
          const last = parseFloat(t.last || '0')
          const change24h = prev > 0 ? (((last - prev) / prev) * 100).toFixed(2) : '0.00'
          updateTicker(instId, {
            last: t.last,
            change24h,
            high24h: t.high24h,
            low24h: t.low24h,
            vol24h: t.volCcy24h || t.vol24h,
          })
        }
      } catch {}
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [instId, bar, updateTicker])

  const changePositive = ticker?.change24h && parseFloat(ticker.change24h) >= 0

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700 flex-shrink-0">
        {/* Pair selector */}
        <div className="flex gap-1">
          {PAIRS.map((p) => (
            <button
              key={p}
              onClick={() => onPairChange?.(p)}
              className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                p === instId
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {p.replace('-SWAP', ' PERP').replace('-USDT', '/USDT')}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700" />

        {/* Bar selector */}
        <div className="flex gap-1">
          {BARS.map((b) => (
            <button
              key={b}
              onClick={() => onBarChange?.(b)}
              className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                b === bar
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-500 hover:text-white hover:bg-slate-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Ticker info */}
        {ticker && (
          <div className="flex items-center gap-4 ml-auto text-xs font-mono">
            <span className="text-white font-semibold text-sm">
              ${parseFloat(ticker.last).toLocaleString()}
            </span>
            <span className={changePositive ? 'text-green-400' : 'text-red-400'}>
              {changePositive ? '+' : ''}{ticker.change24h}%
            </span>
            <span className="text-slate-400 hidden md:block">
              H: {parseFloat(ticker.high24h || '0').toLocaleString()}
            </span>
            <span className="text-slate-400 hidden md:block">
              L: {parseFloat(ticker.low24h || '0').toLocaleString()}
            </span>
            <span className="text-slate-500 hidden lg:block">
              Vol: {parseFloat(ticker.vol24h || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
