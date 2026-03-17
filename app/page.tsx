'use client'

import { useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTradingStore } from '@/store/trading'
import ManualTradePanel from '@/components/ManualTradePanel'
import PositionTable from '@/components/PositionTable'
import AIControlPanel from '@/components/AIControlPanel'
import BalanceBar from '@/components/BalanceBar'
import type { TradingMode, SupportedPair, CandleInterval } from '@/lib/okx/types'

// SSR must be disabled for the chart (uses browser APIs)
const KLineChart = dynamic(() => import('@/components/KLineChart'), { ssr: false })

const MODE_CONFIG: Record<TradingMode, { label: string; color: string; desc: string }> = {
  manual: { label: 'Manual', color: 'bg-slate-600 text-white', desc: 'Full manual control' },
  hybrid: { label: 'Hybrid', color: 'bg-yellow-600 text-white', desc: 'AI suggests, you confirm' },
  ai:     { label: 'AI Auto', color: 'bg-blue-600 text-white', desc: 'AI trades autonomously' },
}

export default function TradingPage() {
  const {
    mode,
    setMode,
    selectedPair,
    selectedBar,
    setSelectedPair,
    setSelectedBar,
    setBalances,
    setPositions,
  } = useTradingStore()

  const [configMissing, setConfigMissing] = useState(false)
  const [activePanel, setActivePanel] = useState<'trade' | 'ai'>('trade')

  const refreshAccountData = useCallback(async () => {
    try {
      const [balRes, posRes] = await Promise.all([
        fetch('/api/okx/balance'),
        fetch('/api/okx/positions'),
      ])
      const [balJson, posJson] = await Promise.all([balRes.json(), posRes.json()])

      if (balJson.ok) setBalances(balJson.data)
      else if (balJson.error?.includes('credentials not configured')) setConfigMissing(true)

      if (posJson.ok) setPositions(posJson.data)
    } catch {}
  }, [setBalances, setPositions])

  useEffect(() => {
    refreshAccountData()
    const interval = setInterval(refreshAccountData, 15000)
    return () => clearInterval(interval)
  }, [refreshAccountData])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Top Nav */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold tracking-tight text-sm">
            OKX <span className="text-blue-400">AI</span> Trading
          </span>
          <span className="text-slate-600 text-xs">powered by MiniMax-M2.5</span>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {(Object.entries(MODE_CONFIG) as [TradingMode, typeof MODE_CONFIG[TradingMode]][]).map(
            ([m, cfg]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={cfg.desc}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  mode === m ? cfg.color : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cfg.label}
              </button>
            )
          )}
        </div>

        <button
          onClick={refreshAccountData}
          className="text-xs text-slate-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
        >
          Refresh
        </button>
      </header>

      {/* Config warning banner */}
      {configMissing && (
        <div className="bg-amber-900/40 border-b border-amber-600/40 text-amber-300 text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="font-bold">⚠</span>
          OKX credentials not configured. Copy <code className="bg-amber-900/60 px-1 rounded">.env.local.example</code> to <code className="bg-amber-900/60 px-1 rounded">.env.local</code> and add your API keys, then restart.
        </div>
      )}

      {/* Balance bar */}
      <BalanceBar />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chart + Positions */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 min-h-0 p-2 pb-1">
            <KLineChart
              instId={selectedPair}
              bar={selectedBar}
              onPairChange={(pair: SupportedPair) => setSelectedPair(pair)}
              onBarChange={(bar: CandleInterval) => setSelectedBar(bar)}
            />
          </div>

          {/* Positions */}
          <div className="flex-shrink-0 p-2 pt-1 max-h-48 overflow-y-auto">
            <PositionTable />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-800 overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-slate-800 flex-shrink-0">
            <button
              onClick={() => setActivePanel('trade')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activePanel === 'trade'
                  ? 'text-white border-b-2 border-blue-500 bg-slate-900/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Trade
            </button>
            <button
              onClick={() => setActivePanel('ai')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activePanel === 'ai'
                  ? 'text-white border-b-2 border-blue-500 bg-slate-900/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              AI Engine
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'trade' ? (
              <div className="h-full overflow-y-auto p-2">
                <ManualTradePanel />
              </div>
            ) : (
              <AIControlPanel />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-1 bg-slate-900 border-t border-slate-800 text-xs text-slate-500 flex-shrink-0">
        <span>
          Mode: <span className="text-white font-medium">{MODE_CONFIG[mode].label}</span>
        </span>
        <span>
          Pair: <span className="text-blue-400 font-mono">{selectedPair}</span>
        </span>
        <span>
          Interval: <span className="text-slate-400 font-mono">{selectedBar}</span>
        </span>
        <span className="ml-auto">
          OKX AI Trading Panel
        </span>
      </div>
    </div>
  )
}
