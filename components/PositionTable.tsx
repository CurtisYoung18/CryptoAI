'use client'

import { useTradingStore } from '@/store/trading'

export default function PositionTable() {
  const positions = useTradingStore((s) => s.positions)
  const tickers = useTradingStore((s) => s.tickers)

  const handleClose = async (instId: string, posSide: string, pos: string) => {
    const side = posSide === 'long' ? 'sell' : 'buy'
    const isSwap = instId.endsWith('-SWAP')
    await fetch('/api/okx/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instId,
        side,
        ordType: 'market',
        sz: Math.abs(parseFloat(pos)).toString(),
        tdMode: isSwap ? 'cross' : 'cash',
        posSide: isSwap ? posSide : undefined,
        reduceOnly: true,
      }),
    })
  }

  if (positions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Positions</h2>
        <div className="text-xs text-slate-500 text-center py-4">No open positions</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3">
        Positions <span className="text-blue-400 ml-1">{positions.length}</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left pb-2">Instrument</th>
              <th className="text-left pb-2">Side</th>
              <th className="text-right pb-2">Size</th>
              <th className="text-right pb-2">Avg Entry</th>
              <th className="text-right pb-2">Mark</th>
              <th className="text-right pb-2">UPL</th>
              <th className="text-right pb-2">UPL%</th>
              <th className="text-right pb-2">Liq</th>
              <th className="text-right pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const upl = parseFloat(pos.upl)
              const uplRatio = parseFloat(pos.uplRatio)
              const isPositive = upl >= 0
              const ticker = tickers[pos.instId]

              return (
                <tr
                  key={i}
                  className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-2 text-white">{pos.instId}</td>
                  <td className={`py-2 font-semibold ${pos.posSide === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                    {pos.posSide.toUpperCase()} {pos.lever}x
                  </td>
                  <td className="py-2 text-right text-white">{parseFloat(pos.pos).toFixed(4)}</td>
                  <td className="py-2 text-right text-slate-300">
                    {parseFloat(pos.avgPx).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-2 text-right text-slate-300">
                    {ticker
                      ? parseFloat(ticker.last).toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : parseFloat(pos.markPx).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className={`py-2 text-right font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{upl.toFixed(2)}
                  </td>
                  <td className={`py-2 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{(uplRatio * 100).toFixed(2)}%
                  </td>
                  <td className="py-2 text-right text-orange-400">
                    {pos.liqPx ? parseFloat(pos.liqPx).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleClose(pos.instId, pos.posSide, pos.pos)}
                      className="px-2 py-0.5 bg-slate-700 hover:bg-red-600/70 text-slate-300 hover:text-white rounded transition-colors text-xs"
                    >
                      Close
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
