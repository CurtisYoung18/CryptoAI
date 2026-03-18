'use client'

import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'

export default function AccountSummary() {
  const balances = useTradingStore(s => s.balances)
  const positions = useTradingStore(s => s.positions)
  const { lang } = useLang()

  const usdt = balances.find(b => b.ccy === 'USDT')
  const totalEquity = balances.reduce((s, b) => s + parseFloat(b.usdVal || '0'), 0)
  const avail = parseFloat(usdt?.availBal || '0')
  const frozen = parseFloat(usdt?.frozenBal || '0')
  const upl = positions.reduce((s, p) => s + parseFloat(p.upl || '0'), 0)
  const uplPos = upl >= 0
  const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

  if (!usdt && balances.length === 0) {
    return (
      <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--c-raise)', border: '1px solid var(--c-border)', fontSize: 11, color: 'var(--c-t4)' }}>
        {lang === 'zh' ? '余额加载中…' : 'Loading…'}
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--c-raise)', border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Equity row */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--c-t3)' }}>{lang === 'zh' ? '账户权益' : 'Equity'}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-t1)' }}>${fmt(totalEquity)}</span>
          {positions.length > 0 && (
            <span className="mono" style={{ fontSize: 11, color: uplPos ? 'var(--c-green)' : 'var(--c-red)' }}>
              {uplPos ? '+' : ''}{fmt(upl)} PnL
            </span>
          )}
        </div>
      </div>

      {/* Available / Frozen */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
        <span style={{ color: 'var(--c-t3)' }}>
          {lang === 'zh' ? '可用 ' : 'Avail '}
          <span className="mono" style={{ color: 'var(--c-green)', fontWeight: 600 }}>${fmt(avail)}</span>
        </span>
        {frozen > 0.01 && (
          <span style={{ color: 'var(--c-t3)' }}>
            {lang === 'zh' ? '冻结 ' : 'Frozen '}
            <span className="mono" style={{ color: 'var(--c-yellow)', fontWeight: 600 }}>${fmt(frozen)}</span>
          </span>
        )}
        {positions.length > 0 && (
          <span style={{ marginLeft: 'auto', color: 'var(--c-t3)' }}>
            {positions.length} {lang === 'zh' ? '个持仓' : 'pos'}
          </span>
        )}
      </div>

      {/* Non-USDT */}
      {balances.filter(b => b.ccy !== 'USDT' && parseFloat(b.bal) > 0).map(b => (
        <div key={b.ccy} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 5, borderTop: '1px solid var(--c-border)', color: 'var(--c-t3)' }}>
          <span>{b.ccy}</span>
          <span className="mono" style={{ color: 'var(--c-t2)' }}>{parseFloat(b.bal).toFixed(6)}</span>
          {parseFloat(b.usdVal) > 0 && <span className="mono" style={{ color: 'var(--c-t4)' }}>${fmt(parseFloat(b.usdVal))}</span>}
        </div>
      ))}
    </div>
  )
}
