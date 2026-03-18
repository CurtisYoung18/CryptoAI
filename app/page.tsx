'use client'

import { useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'
import ManualTradePanel from '@/components/ManualTradePanel'
import PositionTable from '@/components/PositionTable'
import AIControlPanel from '@/components/AIControlPanel'
import AIChatPanel from '@/components/AIChatPanel'
import BalanceBar from '@/components/BalanceBar'
import type { TradingMode, SupportedPair, CandleInterval } from '@/lib/okx/types'

const KLineChart = dynamic(() => import('@/components/KLineChart'), { ssr: false })

type LayoutMode = 'classic' | 'focus'

export default function TradingPage() {
  const {
    mode, setMode, selectedPair, selectedBar,
    setSelectedPair, setSelectedBar, setBalances, setPositions,
    aiRunning, setAiRunning, strategyConfig, setStrategyConfig,
  } = useTradingStore()
  const { lang, setLang, t } = useLang()

  const [configMissing, setConfigMissing] = useState(false)
  const [activePanel, setActivePanel] = useState<'trade' | 'ai'>('trade')
  const [layout, setLayout] = useState<LayoutMode>('classic')

  const MODE_CONFIG: Record<TradingMode, { label: string; desc: string }> = {
    manual: { label: t.modeManual, desc: t.modeManualDesc },
    hybrid: { label: t.modeHybrid, desc: t.modeHybridDesc },
    ai:     { label: t.modeAI,     desc: t.modeAIDesc },
  }

  const handleModeChange = useCallback(async (m: TradingMode) => {
    setMode(m)
    if (m === 'ai') {
      setActivePanel('ai')
      if (!aiRunning) {
        try {
          const updatedConfig = { ...strategyConfig, enabled: true }
          const res = await fetch('/api/ai/strategy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfig),
          })
          const json = await res.json()
          if (json.ok) { setStrategyConfig(json.data.config); setAiRunning(json.data.running) }
        } catch {}
      }
    } else if (aiRunning) {
      try {
        const updatedConfig = { ...strategyConfig, enabled: false }
        const res = await fetch('/api/ai/strategy', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedConfig),
        })
        const json = await res.json()
        if (json.ok) { setStrategyConfig(json.data.config); setAiRunning(json.data.running) }
      } catch {}
    }
  }, [aiRunning, setMode, setAiRunning, setStrategyConfig, strategyConfig])

  const refreshAccountData = useCallback(async () => {
    try {
      const [balRes, posRes] = await Promise.all([
        fetch('/api/okx/balance'), fetch('/api/okx/positions'),
      ])
      const [balJson, posJson] = await Promise.all([balRes.json(), posRes.json()])
      if (balJson.ok) setBalances(balJson.data)
      else if (balJson.error?.includes('credentials not configured')) setConfigMissing(true)
      if (posJson.ok) setPositions(posJson.data)
    } catch {}
  }, [setBalances, setPositions])

  useEffect(() => {
    refreshAccountData()
    const iv = setInterval(refreshAccountData, 15000)
    return () => clearInterval(iv)
  }, [refreshAccountData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--c-bg)' }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: '44px', flexShrink: 0,
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>A</div>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-t1)', letterSpacing: '-0.3px' }}>
              OKX Trading
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--c-t3)', paddingLeft: 4 }} className="hidden md:block">
            {t.poweredBy}
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode - classic only */}
          {layout === 'classic' && (
            <div className="seg">
              {(Object.entries(MODE_CONFIG) as [TradingMode, { label: string; desc: string }][]).map(([m, cfg]) => (
                <button key={m} onClick={() => handleModeChange(m)} title={cfg.desc}
                  className={mode === m ? (m === 'ai' ? 'on-blue' : 'on') : ''}>
                  {m === 'ai' && aiRunning && (
                    <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--c-green)', marginRight: 4, verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }} />
                  )}
                  {cfg.label}
                </button>
              ))}
            </div>
          )}

          {/* Layout */}
          <div className="seg">
            <button className={layout === 'classic' ? 'on' : ''} onClick={() => setLayout('classic')}>
              {t.layoutClassic}
            </button>
            <button className={layout === 'focus' ? 'on-blue' : ''} onClick={() => setLayout('focus')}>
              {t.layoutSimple}
            </button>
          </div>

          {/* Language */}
          <div className="seg">
            <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>

          <button onClick={refreshAccountData} style={{
            fontSize: 11, color: 'var(--c-t3)', padding: '4px 8px',
            borderRadius: 6, background: 'transparent', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-t1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-t3)')}>
            ↻
          </button>
        </div>
      </header>

      {/* Config missing warning */}
      {configMissing && (
        <div style={{
          padding: '6px 16px', fontSize: 12, flexShrink: 0,
          background: 'rgba(234,179,8,0.08)',
          borderBottom: '1px solid rgba(234,179,8,0.15)',
          color: 'var(--c-yellow)',
        }}>
          ⚠ {t.configMissing}
        </div>
      )}

      <BalanceBar />

      {/* ── CLASSIC ── */}
      {layout === 'classic' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Chart area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, padding: '8px 8px 4px' }}>
              <KLineChart
                instId={selectedPair} bar={selectedBar}
                onPairChange={(p: SupportedPair) => setSelectedPair(p)}
                onBarChange={(b: CandleInterval) => setSelectedBar(b)}
              />
            </div>
            <div style={{ flexShrink: 0, padding: '4px 8px 8px', maxHeight: 180, overflowY: 'auto' }}>
              <PositionTable />
            </div>
          </div>

          {/* Right panel */}
          <div style={{
            width: 308, flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderLeft: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
            overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
              {(['trade', 'ai'] as const).map(p => (
                <button key={p} onClick={() => setActivePanel(p)} style={{
                  flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 500,
                  color: activePanel === p ? 'var(--c-t1)' : 'var(--c-t3)',
                  borderBottom: activePanel === p ? '2px solid var(--c-blue)' : '2px solid transparent',
                  background: 'transparent', transition: 'all 0.15s',
                }}>
                  {p === 'trade' ? t.tabTrade : t.tabAI}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activePanel === 'trade'
                ? <div style={{ height: '100%', overflowY: 'auto', padding: 8 }}><ManualTradePanel /></div>
                : <AIControlPanel />}
            </div>
          </div>
        </div>
      )}

      {/* ── FOCUS ── */}
      {layout === 'focus' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Chat */}
          <div style={{ flex: 1, minWidth: 0, padding: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AIChatPanel />
          </div>

          {/* Right */}
          <div style={{
            width: 308, flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderLeft: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
            overflow: 'hidden',
          }}>
            <div style={{ flexShrink: 0, padding: '8px 8px 6px', borderBottom: '1px solid var(--c-border)', maxHeight: 200, overflowY: 'auto' }}>
              <PositionTable />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <AIControlPanel />
            </div>
          </div>
        </div>
      )}

      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 16px', height: 26, flexShrink: 0,
        borderTop: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        fontSize: 11, color: 'var(--c-t3)',
      }}>
        <span>{t.mode}: <span style={{ color: 'var(--c-t2)' }}>{MODE_CONFIG[mode].label}</span></span>
        <span>{t.pair}: <span className="mono" style={{ color: 'var(--c-blue)' }}>{selectedPair}</span></span>
        {layout === 'classic' && <span className="mono" style={{ color: 'var(--c-t4)' }}>{selectedBar}</span>}
        <span style={{ marginLeft: 'auto' }}>OKX AI Trading</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
