'use client'

import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'

export default function BalanceBar() {
  const balances = useTradingStore(s => s.balances)
  const { t } = useLang()
  const sig = balances.filter(b => parseFloat(b.bal) > 0)
  if (sig.length === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      padding: '0 16px', height: 32, flexShrink: 0,
      background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
      overflowX: 'auto',
    }}>
      <span style={{ fontSize: 11, color: 'var(--c-t4)', flexShrink: 0 }}>{t.balance}</span>
      {sig.map(b => (
        <div key={b.ccy} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--c-t3)', fontWeight: 500 }}>{b.ccy}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--c-t1)', fontWeight: 600 }}>
            {parseFloat(b.bal).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
          <span style={{ fontSize: 11, color: 'var(--c-t4)' }}>
            / {parseFloat(b.availBal).toLocaleString(undefined, { maximumFractionDigits: 4 })} {t.available}
          </span>
        </div>
      ))}
    </div>
  )
}
