'use client'

import { useTradingStore } from '@/store/trading'

export default function BalanceBar() {
  const balances = useTradingStore((s) => s.balances)

  const significant = balances.filter(b => parseFloat(b.bal) > 0)

  if (significant.length === 0) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono overflow-x-auto">
      <span className="text-slate-500 flex-shrink-0">Balance</span>
      {significant.map(b => (
        <div key={b.ccy} className="flex items-center gap-1 flex-shrink-0">
          <span className="text-slate-400">{b.ccy}</span>
          <span className="text-white font-semibold">
            {parseFloat(b.bal).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
          <span className="text-slate-500">
            (avail: {parseFloat(b.availBal).toLocaleString(undefined, { maximumFractionDigits: 4 })})
          </span>
        </div>
      ))}
    </div>
  )
}
