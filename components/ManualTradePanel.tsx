'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'
import type { SupportedPair } from '@/lib/okx/types'
import AccountSummary from '@/components/AccountSummary'

type OrderSide = 'buy' | 'sell'
type OrderType = 'market' | 'limit'
type SizeMode = 'usdt' | 'contracts'

interface Props {
  defaultPair?: SupportedPair
}

// OKX contract sizes (1 contract = X base asset)
const CONTRACT_SIZE: Record<string, number> = {
  'ETH-USDT-SWAP': 0.1,   // 1 contract = 0.1 ETH
  'BTC-USDT-SWAP': 0.01,  // 1 contract = 0.01 BTC
  'ETH-USDT': 1,
  'BTC-USDT': 1,
}

export default function ManualTradePanel({ defaultPair }: Props) {
  const selectedPair = useTradingStore((s) => s.selectedPair)
  const mode = useTradingStore((s) => s.mode)
  const tickers = useTradingStore((s) => s.tickers)
  const { t, lang } = useLang()

  const [side, setSide] = useState<OrderSide>('buy')
  const [ordType, setOrdType] = useState<OrderType>('market')
  const [sizeMode, setSizeMode] = useState<SizeMode>('usdt')
  const [usdtAmt, setUsdtAmt] = useState('')
  const [contractSz, setContractSz] = useState('')
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
  const lastPrice = ticker ? parseFloat(ticker.last) : 0
  const ctSize = CONTRACT_SIZE[pair] ?? 1

  // Clear limit price when switching order type or pair
  useEffect(() => {
    setPx('')
  }, [ordType, pair])

  // Calculate contracts from USDT
  const estimatedContracts = useMemo(() => {
    if (!usdtAmt || !lastPrice || lastPrice <= 0) return 0
    const usdt = parseFloat(usdtAmt)
    if (isNaN(usdt) || usdt <= 0) return 0
    if (isSwap) {
      // contracts = USDT / (price * ctSize)
      return Math.floor(usdt / (lastPrice * ctSize))
    }
    // spot: quantity = USDT / price
    return usdt / lastPrice
  }, [usdtAmt, lastPrice, isSwap, ctSize])

  // The actual sz to send to OKX
  const finalSz = useMemo(() => {
    if (sizeMode === 'usdt') {
      if (!lastPrice) return ''
      if (isSwap) return estimatedContracts > 0 ? String(estimatedContracts) : ''
      return estimatedContracts > 0 ? estimatedContracts.toFixed(6) : ''
    }
    return contractSz
  }, [sizeMode, estimatedContracts, contractSz, isSwap, lastPrice])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const sz = finalSz
    if (!sz || parseFloat(sz) <= 0) {
      setStatus({ type: 'err', msg: t.enterValidSize })
      return
    }
    if (ordType === 'limit' && (!px || parseFloat(px) <= 0)) {
      setStatus({ type: 'err', msg: t.enterValidPrice })
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
        setStatus({ type: 'ok', msg: `${t.orderPlaced}: ${json.data?.[0]?.ordId ?? 'success'}` })
        setUsdtAmt(''); setContractSz(''); setPx(''); setSlPx(''); setTpPx('')
      } else {
        setStatus({ type: 'err', msg: json.error ?? t.orderFailed })
      }
    } catch (err) {
      setStatus({ type: 'err', msg: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const disabled = mode === 'ai'

  const S = {
    label: { fontSize: 11, color: 'var(--c-t3)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    row: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
    input: { width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 13 },
    segRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, background: 'var(--c-raise)', borderRadius: 8, padding: 3 },
    segBtn: (active: boolean, color?: string) => ({
      padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
      background: active ? (color ?? 'var(--c-card)') : 'transparent',
      color: active ? '#fff' : 'var(--c-t3)',
      transition: 'all 0.15s', cursor: 'pointer', border: 'none',
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
    } as React.CSSProperties),
  }

  return (
    <div style={{ background: 'var(--c-card)', borderRadius: 12, border: '1px solid var(--c-border)', padding: 14, height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-t1)' }}>{t.manualTrade}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--c-t4)' }}>{pair}</span>
      </div>

      <AccountSummary />

      {disabled && (
        <div style={{ fontSize: 11, padding: '7px 10px', borderRadius: 7, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)', color: 'var(--c-yellow)' }}>
          {t.aiModeActive}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Buy / Sell */}
        <div style={S.segRow}>
          {(['buy', 'sell'] as OrderSide[]).map(s => (
            <button key={s} type="button" onClick={() => { setSide(s); setPosSide(s === 'buy' ? 'long' : 'short') }} disabled={disabled}
              style={S.segBtn(side === s, s === 'buy' ? 'var(--c-green)' : 'var(--c-red)')}>
              {s === 'buy' ? t.buy : t.sell}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div style={S.segRow}>
          {(['market', 'limit'] as OrderType[]).map(tp => (
            <button key={tp} type="button" onClick={() => setOrdType(tp)} disabled={disabled}
              style={S.segBtn(ordType === tp)}>
              {tp === 'market' ? t.market : t.limit}
            </button>
          ))}
        </div>

        {/* Market: live ref price */}
        {ordType === 'market' && ticker && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 7, background: 'var(--c-raise)', border: '1px solid var(--c-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--c-t3)' }}>{lang === 'zh' ? '参考成交价' : 'Est. Price'}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-t1)' }}>
              ${parseFloat(ticker.last).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Size mode */}
        <div style={S.segRow}>
          <button type="button" onClick={() => setSizeMode('usdt')} style={S.segBtn(sizeMode === 'usdt', 'rgba(59,130,246,0.25)')}>USDT</button>
          <button type="button" onClick={() => setSizeMode('contracts')} style={S.segBtn(sizeMode === 'contracts', 'rgba(59,130,246,0.25)')}>
            {isSwap ? t.sizeModeContracts : t.quantity}
          </button>
        </div>

        {/* Size input */}
        {sizeMode === 'usdt' ? (
          <div style={S.row}>
            <label style={S.label}>
              <span>{t.usdtAmount}</span>
              {lastPrice > 0 && (
                <span className="mono" style={{ color: 'var(--c-t4)' }}>
                  {isSwap ? `≈ ${estimatedContracts} 张` : `≈ ${estimatedContracts > 0 ? estimatedContracts.toFixed(4) : '0'} ${pair.split('-')[0]}`}
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={usdtAmt} onChange={e => setUsdtAmt(e.target.value)}
                placeholder="10" step="any" min="0" disabled={disabled}
                style={{ ...S.input, paddingRight: 48 }} />
              <span className="mono" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--c-t3)' }}>USDT</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['10', '20', '50', '100'].map(a => (
                <button key={a} type="button" onClick={() => setUsdtAmt(a)} disabled={disabled}
                  style={{ flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 6, background: 'var(--c-raise)', border: '1px solid var(--c-border)', color: 'var(--c-t3)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-t1)'; e.currentTarget.style.borderColor = 'var(--c-blue)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-t3)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={S.row}>
            <label style={S.label}>
              <span>{isSwap ? t.sizeModeContracts : t.quantity}</span>
              {isSwap && lastPrice > 0 && contractSz && (
                <span className="mono" style={{ color: 'var(--c-t4)' }}>≈ ${(parseFloat(contractSz) * ctSize * lastPrice).toFixed(2)}</span>
              )}
            </label>
            <input type="number" value={contractSz} onChange={e => setContractSz(e.target.value)}
              placeholder={isSwap ? '1' : '0.001'} step="any" min="0" disabled={disabled} style={S.input} />
          </div>
        )}

        {/* Limit price */}
        {ordType === 'limit' && (
          <div style={S.row}>
            <label style={S.label}>
              <span>{t.limitPrice}</span>
              {ticker && (
                <span className="mono" style={{ color: 'var(--c-t3)' }}>
                  {lang === 'zh' ? '最新 ' : 'Last '}
                  <span style={{ color: 'var(--c-blue)' }}>
                    ${parseFloat(ticker.last).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              )}
            </label>
            <input type="number" value={px} onChange={e => setPx(e.target.value)}
              placeholder={lastPrice > 0 ? String(lastPrice) : '0.00'} step="any" min="0" disabled={disabled} style={S.input} />
          </div>
        )}

        {/* Leverage */}
        {isSwap && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...S.row, flex: 1 }}>
              <label style={{ ...S.label, marginBottom: 4 }}>{t.leverage}</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {['3', '5', '10', '20'].map(l => (
                  <button key={l} type="button" onClick={() => setLever(l)} disabled={disabled}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      background: lever === l ? 'var(--c-raise)' : 'transparent',
                      border: `1px solid ${lever === l ? 'var(--c-border2)' : 'var(--c-border)'}`,
                      color: lever === l ? 'var(--c-t1)' : 'var(--c-t4)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {l}x
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...S.row, width: 88 }}>
              <label style={{ ...S.label, marginBottom: 4 }}>{t.marginMode}</label>
              <select value={tdMode} onChange={e => setTdMode(e.target.value as 'cross' | 'isolated')} disabled={disabled}
                style={{ padding: '5px 8px', fontSize: 12 }}>
                <option value="cross">{t.cross}</option>
                <option value="isolated">{t.isolated}</option>
              </select>
            </div>
          </div>
        )}

        {/* TP / SL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={S.row}>
            <label style={S.label}>{t.takeProfit}</label>
            <input type="number" value={tpPx} onChange={e => setTpPx(e.target.value)}
              placeholder={t.optional} step="any" disabled={disabled}
              style={{ ...S.input, borderColor: tpPx ? 'rgba(34,197,94,0.4)' : undefined }} />
          </div>
          <div style={S.row}>
            <label style={S.label}>{t.stopLoss}</label>
            <input type="number" value={slPx} onChange={e => setSlPx(e.target.value)}
              placeholder={t.optional} step="any" disabled={disabled}
              style={{ ...S.input, borderColor: slPx ? 'rgba(239,68,68,0.4)' : undefined }} />
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={disabled || loading || !finalSz || parseFloat(finalSz) <= 0}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: side === 'buy' ? 'var(--c-green)' : 'var(--c-red)',
            color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
            opacity: (disabled || loading || !finalSz || parseFloat(finalSz || '0') <= 0) ? 0.4 : 1,
          }}>
          {loading ? t.placing : `${side === 'buy' ? t.buy : t.sell} ${pair}`}
        </button>

        {status && (
          <div style={{
            fontSize: 12, padding: '7px 10px', borderRadius: 7,
            background: status.type === 'ok' ? 'var(--c-green-d)' : 'var(--c-red-d)',
            border: `1px solid ${status.type === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: status.type === 'ok' ? 'var(--c-green)' : 'var(--c-red)',
          }}>
            {status.msg}
          </div>
        )}
      </form>
    </div>
  )
}
