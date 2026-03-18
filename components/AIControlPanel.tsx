'use client'

import { useState, useEffect, useRef } from 'react'
import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'
import type { StrategyConfig } from '@/lib/strategy/runner'
import { DEFAULT_STRATEGY } from '@/lib/strategy/runner'
import type { SupportedPair, CandleInterval } from '@/lib/okx/types'
import type { RunnerLog } from '@/lib/strategy/runner'
import AccountSummary from '@/components/AccountSummary'

const PAIRS: SupportedPair[] = ['ETH-USDT-SWAP', 'BTC-USDT-SWAP', 'ETH-USDT', 'BTC-USDT']
const BARS: CandleInterval[] = ['1m', '5m', '15m', '30m', '1H', '4H']
const INTERVALS = [
  { label: '30s', ms: 30000 },
  { label: '1m',  ms: 60000 },
  { label: '2m',  ms: 120000 },
  { label: '5m',  ms: 300000 },
  { label: '10m', ms: 600000 },
]

const LOG_COLOR: Record<RunnerLog['type'], string> = {
  info:     'rgba(255,255,255,0.45)',
  decision: '#60a5fa',
  trade:    '#4ade80',
  error:    '#f87171',
  risk:     '#fb923c',
}
const LOG_BG: Record<RunnerLog['type'], string> = {
  info:     'transparent',
  decision: 'rgba(59,130,246,0.06)',
  trade:    'rgba(74,222,128,0.06)',
  error:    'rgba(248,113,113,0.08)',
  risk:     'rgba(251,146,60,0.07)',
}
const LOG_DOT: Record<RunnerLog['type'], string> = {
  info:     'rgba(255,255,255,0.2)',
  decision: '#3b82f6',
  trade:    '#22c55e',
  error:    '#ef4444',
  risk:     '#f97316',
}

export default function AIControlPanel() {
  const { logs, addLog, aiRunning, setAiRunning, setStrategyConfig } = useTradingStore()
  const { t } = useLang()
  const logsEndRef = useRef<HTMLDivElement>(null)

  const [localConfig, setLocalConfig] = useState<StrategyConfig>({ ...DEFAULT_STRATEGY })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'config' | 'logs'>('config')

  useEffect(() => {
    fetch('/api/ai/strategy').then(r => r.json()).then(d => {
      if (d.ok) {
        setLocalConfig(d.data.config)
        setStrategyConfig(d.data.config)
        setAiRunning(d.data.running)
        if (d.data.running) setTab('logs')
      }
    }).catch(() => {})

    const es = new EventSource('/api/ai/logs')
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'init') {
          for (const log of msg.logs) addLog(log)
          setAiRunning(msg.running)
          if (msg.running) setTab('logs')
        } else if (msg.type === 'log') {
          addLog(msg.log)
        }
      } catch {}
    }
    return () => es.close()
  }, [addLog, setAiRunning, setStrategyConfig])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const save = async (config = localConfig) => {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (json.ok) {
        setStrategyConfig(json.data.config)
        setAiRunning(json.data.running)
        setLocalConfig(json.data.config)
        if (json.data.running) setTab('logs')
      }
    } finally { setSaving(false) }
  }

  const toggleAI = () => save({ ...localConfig, enabled: !localConfig.enabled })

  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--c-t3)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }
  const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', flexShrink: 0,
        borderBottom: '1px solid var(--c-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: aiRunning ? 'var(--c-green)' : 'var(--c-t4)',
            boxShadow: aiRunning ? '0 0 8px var(--c-green)' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-t1)' }}>MiniMax-M2.5</span>
          {aiRunning && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              color: 'var(--c-green)', letterSpacing: '0.05em',
            }}>
              LIVE
            </span>
          )}
        </div>
        <button onClick={toggleAI} disabled={saving} style={{
          padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: localConfig.enabled ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          border: `1px solid ${localConfig.enabled ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
          color: localConfig.enabled ? 'var(--c-red)' : 'var(--c-green)',
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, transition: 'all 0.15s',
        }}>
          {saving ? '…' : localConfig.enabled ? t.stopAI : t.startAI}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
        {(['config', 'logs'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} style={{
            flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500,
            color: tab === tb ? 'var(--c-t1)' : 'var(--c-t4)',
            borderBottom: tab === tb ? '2px solid var(--c-blue)' : '2px solid transparent',
            background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {tb === 'config' ? t.strategyConfig : `${t.logs}${logs.length > 0 ? ` · ${logs.length}` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* CONFIG TAB */}
        {tab === 'config' && (
          <div style={{ padding: '14px 14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <AccountSummary />

            {/* Pair + Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={field}>
                <label style={lbl}>{t.instrumentLabel}</label>
                <select value={localConfig.instId}
                  onChange={e => setLocalConfig({ ...localConfig, instId: e.target.value as SupportedPair })}
                  style={{ padding: '7px 10px', fontSize: 12, borderRadius: 7 }}>
                  {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={field}>
                <label style={lbl}>{t.candleBar}</label>
                <select value={localConfig.bar}
                  onChange={e => setLocalConfig({ ...localConfig, bar: e.target.value as CandleInterval })}
                  style={{ padding: '7px 10px', fontSize: 12, borderRadius: 7 }}>
                  {BARS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Interval */}
            <div style={field}>
              <label style={lbl}>{t.aiCycleInterval}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {INTERVALS.map(iv => (
                  <button key={iv.ms} onClick={() => setLocalConfig({ ...localConfig, intervalMs: iv.ms })} style={{
                    flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    background: localConfig.intervalMs === iv.ms ? 'var(--c-blue)' : 'var(--c-raise)',
                    border: `1px solid ${localConfig.intervalMs === iv.ms ? 'transparent' : 'var(--c-border)'}`,
                    color: localConfig.intervalMs === iv.ms ? '#fff' : 'var(--c-t3)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {iv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max loss + Leverage */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={field}>
                <label style={lbl}>{t.maxDailyLoss}</label>
                <input type="number" value={localConfig.maxDailyLoss}
                  onChange={e => setLocalConfig({ ...localConfig, maxDailyLoss: e.target.value })}
                  style={{ padding: '7px 10px', fontSize: 12, borderRadius: 7 }} />
              </div>
              <div style={field}>
                <label style={lbl}>{t.leverageLabel}</label>
                <input type="number" value={localConfig.lever} min="1" max="100"
                  onChange={e => setLocalConfig({ ...localConfig, lever: e.target.value })}
                  style={{ padding: '7px 10px', fontSize: 12, borderRadius: 7 }} />
              </div>
            </div>

            {/* Strategy prompt */}
            <div style={field}>
              <label style={lbl}>{t.strategyPrompt}</label>
              <textarea value={localConfig.prompt} rows={7}
                onChange={e => setLocalConfig({ ...localConfig, prompt: e.target.value })}
                style={{
                  padding: '9px 10px', fontSize: 12, borderRadius: 7,
                  fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                  lineHeight: 1.6, resize: 'vertical',
                }} />
            </div>

            <button onClick={() => save()} disabled={saving} style={{
              width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700,
              borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: 'var(--c-blue)', color: '#fff',
              opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s',
            }}>
              {saving ? t.saving : t.saveStrategy}
            </button>
          </div>
        )}

        {/* LOGS TAB */}
        {tab === 'logs' && (
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'var(--c-t4)' }}>{t.noLogs}</div>
            ) : (
              [...logs].reverse().map(log => (
                <div key={log.id} style={{
                  display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 6,
                  background: LOG_BG[log.type],
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = LOG_BG[log.type])}>
                  {/* Dot */}
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: LOG_DOT[log.type],
                    boxShadow: log.type !== 'info' ? `0 0 5px ${LOG_DOT[log.type]}50` : 'none',
                  }} />
                  {/* Time */}
                  <span className="mono" style={{ fontSize: 10, color: 'var(--c-t4)', flexShrink: 0, paddingTop: 1, minWidth: 52 }}>
                    {new Date(log.ts).toLocaleTimeString()}
                  </span>
                  {/* Message */}
                  <span style={{ fontSize: 11, color: LOG_COLOR[log.type], lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
