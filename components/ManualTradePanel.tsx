'use client'

import { useState } from 'react'
import { useTradingStore } from '@/store/trading'
import type { SupportedPair } from '@/lib/okx/types'

type OrderSide = 'buy' | 'sell'
type OrderType = 'market' | 'limit'

interface Props {
  defaultPair?: SupportedPair
}

export default function ManualTradePanel({ defaultPair }: Props) {
  const selectedPair = useTradingStore((s) => s.selectedPair)
  const mode = useTradingStore((s) => s.mode)
  const tickers = useTradingStore((s) => s.tickers)

  const [side, setSide] = useState<OrderSide>('buy')
  const [ordType, setOrdType] = useState<OrderType>('market')
  const [sz, setSz] = useState('')
  const [px, setPx] = useState('')
  const [lever, setLever] = useState('5')
  const [tdMode, setTdMode] = useState<'cross' | 'isolated' | 'cash'>('cross')
  const [posSide, setPosSide] = useState<'long' | 'short'>('long')
  const [slPx, setSlPx] = useState('')
  const [tpPx, setTpPx] = useState('')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const pair = defaultPair ?? selectedPair
  const isSwap = pair.endsWith('-SWAP')
  const ticker = tickers[pair]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sz || parseFloat(sz) <= 0) {
      setStatus({ type: 'err', msg: 'Enter a valid size' })
      return
    }
    if (ordType === 'limit' && (!px || parseFloat(px) <= 0)) {
      setStatus({ type: 'err', msg: 'Enter a valid limit price' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const body: Record<string, string> = {
        instId: pair,
        side,
        ordType,
        sz,
        tdMode: isSwap ? tdMode : 'cash',
        ...(isSwap && { posSide, lever }),
        ...(ordType === 'limit' && { px }),
        ...(slPx && { slTriggerPx: slPx, slOrdPx: '-1' }),
        ...(tpPx && { tpTriggerPx: tpPx, tpOrdPx: '-1' }),
      }

      const res = await fetch('/api/okx/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.ok) {
        setStatus({ type: 'ok', msg: `Order placed: ${json.data?.[0]?.ordId ?? 'success'}` })
        setSz('')
        setPx('')
        setSlPx('')
        setTpPx('')
      } else {
        setStatus({ type: 'err', msg: json.error ?? 'Order failed' })
      }
    } catch (err) {
      setStatus({ type: 'err', msg: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const disabled = mode === 'ai'

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Manual Trade</h2>
        <span className="text-xs text-slate-500 font-mono">{pair}</span>
      </div>

      {disabled && (
        <div className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-3 py-2">
          AI Mode active — switch to Manual or Hybrid to trade manually
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Buy / Sell */}
        <div className="grid grid-cols-2 gap-1 bg-slate-800 rounded-lg p-1">
          {(['buy', 'sell'] as OrderSide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSide(s); setPosSide(s === 'buy' ? 'long' : 'short') }}
              disabled={disabled}
              className={`py-1.5 text-sm font-semibold rounded-md transition-colors ${
                side === s
                  ? s === 'buy'
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div className="flex gap-2">
          {(['market', 'limit'] as OrderType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOrdType(t)}
              disabled={disabled}
              className={`flex-1 py-1 text-xs rounded transition-colors ${
                ordType === t
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">
            Size {isSwap ? '(contracts)' : '(quantity)'}
          </label>
          <input
            type="number"
            value={sz}
            onChange={(e) => setSz(e.target.value)}
            placeholder={isSwap ? '1' : '0.001'}
            step="any"
            min="0"
            disabled={disabled}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Limit price */}
        {ordType === 'limit' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 flex items-center justify-between">
              Limit Price
              {ticker && (
                <span
                  className="text-blue-400 cursor-pointer"
                  onClick={() => setPx(ticker.last)}
                >
                  Last: {parseFloat(ticker.last).toLocaleString()}
                </span>
              )}
            </label>
            <input
              type="number"
              value={px}
              onChange={(e) => setPx(e.target.value)}
              placeholder="0.00"
              step="any"
              min="0"
              disabled={disabled}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        )}

        {/* Leverage (SWAP only) */}
        {isSwap && (
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Leverage</label>
              <input
                type="number"
                value={lever}
                onChange={(e) => setLever(e.target.value)}
                min="1"
                max="100"
                disabled={disabled}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Margin Mode</label>
              <select
                value={tdMode}
                onChange={(e) => setTdMode(e.target.value as 'cross' | 'isolated')}
                disabled={disabled}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="cross">Cross</option>
                <option value="isolated">Isolated</option>
              </select>
            </div>
          </div>
        )}

        {/* TP/SL */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Take Profit</label>
            <input
              type="number"
              value={tpPx}
              onChange={(e) => setTpPx(e.target.value)}
              placeholder="Optional"
              step="any"
              disabled={disabled}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Stop Loss</label>
            <input
              type="number"
              value={slPx}
              onChange={(e) => setSlPx(e.target.value)}
              placeholder="Optional"
              step="any"
              disabled={disabled}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={disabled || loading}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            side === 'buy'
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Placing...' : `${side.toUpperCase()} ${pair}`}
        </button>

        {status && (
          <div
            className={`text-xs rounded px-3 py-2 ${
              status.type === 'ok'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {status.msg}
          </div>
        )}
      </form>
    </div>
  )
}
