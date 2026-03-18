'use client'

import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'

export default function PositionTable() {
  const positions = useTradingStore(s => s.positions)
  const tickers = useTradingStore(s => s.tickers)
  const { t } = useLang()

  const handleClose = async (instId: string, posSide: string, pos: string) => {
    await fetch('/api/okx/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instId,
        side: posSide === 'long' ? 'sell' : 'buy',
        ordType: 'market',
        sz: Math.abs(parseFloat(pos)).toString(),
        tdMode: instId.endsWith('-SWAP') ? 'cross' : 'cash',
        posSide: instId.endsWith('-SWAP') ? posSide : undefined,
        reduceOnly: true,
      }),
    })
  }

  const card: React.CSSProperties = {
    background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px',
  }

  if (positions.length === 0) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--c-t1)' }}>{t.positions}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-t4)', textAlign: 'center', padding: '10px 0' }}>{t.noPositions}</div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--c-t1)' }}>{t.positions}</span>
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--c-blue-d)', color: 'var(--c-blue)' }}>{positions.length}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} className="mono">
          <thead>
            <tr style={{ color: 'var(--c-t4)', borderBottom: '1px solid var(--c-border)' }}>
              {[t.instrument, t.side, t.sizeCol, t.avgEntry, t.markPrice, t.upl, t.liq, ''].map((h, i) => (
                <th key={i} style={{ paddingBottom: 6, fontWeight: 500, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const upl = parseFloat(pos.upl)
              const uplRatio = parseFloat(pos.uplRatio)
              const pos_ = upl >= 0
              const ticker = tickers[pos.instId]
              const mark = ticker ? parseFloat(ticker.last) : parseFloat(pos.markPx)

              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--c-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '7px 0', color: 'var(--c-t1)', fontWeight: 500 }}>{pos.instId.replace('-USDT-SWAP', '').replace('-USDT', '')}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right' }}>
                    <span style={{
                      color: pos.posSide === 'long' ? 'var(--c-green)' : 'var(--c-red)',
                      fontWeight: 600,
                    }}>
                      {pos.posSide === 'long' ? t.long : t.short}
                    </span>
                    <span style={{ color: 'var(--c-t4)', marginLeft: 2 }}>{pos.lever}x</span>
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--c-t2)' }}>{parseFloat(pos.pos).toFixed(4)}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--c-t2)' }}>{parseFloat(pos.avgPx).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--c-t2)' }}>{mark.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: pos_ ? 'var(--c-green)' : 'var(--c-red)' }}>
                    {pos_ ? '+' : ''}{upl.toFixed(2)}
                    <span style={{ fontWeight: 400, marginLeft: 3, color: pos_ ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' }}>
                      {pos_ ? '+' : ''}{(uplRatio * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--c-yellow)' }}>
                    {pos.liqPx ? parseFloat(pos.liqPx).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right' }}>
                    <button onClick={() => handleClose(pos.instId, pos.posSide, pos.pos)}
                      style={{
                        padding: '3px 8px', fontSize: 10, borderRadius: 5, cursor: 'pointer',
                        background: 'var(--c-raise)', border: '1px solid var(--c-border2)',
                        color: 'var(--c-t3)', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-red-d)'; e.currentTarget.style.color = 'var(--c-red)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-raise)'; e.currentTarget.style.color = 'var(--c-t3)' }}>
                      {t.close}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
