'use client'

import { useState, useEffect } from 'react'
import { useTradingStore } from '@/store/trading'
import type { StrategyConfig } from '@/lib/strategy/runner'
import { DEFAULT_STRATEGY } from '@/lib/strategy/runner'
import type { SupportedPair, CandleInterval } from '@/lib/okx/types'
import type { RunnerLog } from '@/lib/strategy/runner'

const SUPPORTED_PAIRS: SupportedPair[] = ['ETH-USDT-SWAP', 'BTC-USDT-SWAP', 'ETH-USDT', 'BTC-USDT']
const BARS: CandleInterval[] = ['1m', '5m', '15m', '30m', '1H', '4H']
const INTERVALS = [
  { label: '30s', ms: 30000 },
  { label: '1m', ms: 60000 },
  { label: '2m', ms: 120000 },
  { label: '5m', ms: 300000 },
  { label: '10m', ms: 600000 },
]

const LOG_COLORS: Record<RunnerLog['type'], string> = {
  info: 'text-slate-400',
  decision: 'text-blue-400',
  trade: 'text-green-400',
  error: 'text-red-400',
  risk: 'text-orange-400',
}

const LOG_ICONS: Record<RunnerLog['type'], string> = {
  info: '●',
  decision: '◆',
  trade: '▲',
  error: '✕',
  risk: '⚠',
}

export default function AIControlPanel() {
  const { logs, addLog, aiRunning, setAiRunning, strategyConfig, setStrategyConfig } = useTradingStore()

  const [localConfig, setLocalConfig] = useState<StrategyConfig>({ ...DEFAULT_STRATEGY })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'config' | 'logs'>('config')

  useEffect(() => {
    // Fetch current config from server
    fetch('/api/ai/strategy').then(r => r.json()).then(d => {
      if (d.ok) {
        setLocalConfig(d.data.config)
        setStrategyConfig(d.data.config)
        setAiRunning(d.data.running)
      }
    }).catch(() => {})

    // Subscribe to AI log stream
    const es = new EventSource('/api/ai/logs')
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'init') {
          for (const log of msg.logs) addLog(log)
          setAiRunning(msg.running)
        } else if (msg.type === 'log') {
          addLog(msg.log)
        }
      } catch {}
    }

    return () => es.close()
  }, [addLog, setAiRunning, setStrategyConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      })
      const json = await res.json()
      if (json.ok) {
        setStrategyConfig(json.data.config)
        setAiRunning(json.data.running)
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleAI = async () => {
    const updated = { ...localConfig, enabled: !localConfig.enabled }
    setLocalConfig(updated)
    setSaving(true)
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      const json = await res.json()
      if (json.ok) {
        setStrategyConfig(json.data.config)
        setAiRunning(json.data.running)
        setLocalConfig(json.data.config)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${aiRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          <h2 className="text-sm font-semibold text-white">MiniMax-M2.5 AI</h2>
        </div>
        <button
          onClick={toggleAI}
          disabled={saving}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            localConfig.enabled
              ? 'bg-red-600/80 hover:bg-red-600 text-white'
              : 'bg-green-600/80 hover:bg-green-600 text-white'
          } disabled:opacity-50`}
        >
          {localConfig.enabled ? 'Stop AI' : 'Start AI'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 flex-shrink-0">
        {(['config', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'config' ? 'Strategy Config' : `Logs (${logs.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'config' && (
          <div className="p-4 flex flex-col gap-3">
            {/* Instrument & Bar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Instrument</label>
                <select
                  value={localConfig.instId}
                  onChange={(e) => setLocalConfig({ ...localConfig, instId: e.target.value as SupportedPair })}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {SUPPORTED_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Candle Bar</label>
                <select
                  value={localConfig.bar}
                  onChange={(e) => setLocalConfig({ ...localConfig, bar: e.target.value as CandleInterval })}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {BARS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Interval */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">AI Cycle Interval</label>
              <div className="flex gap-1">
                {INTERVALS.map(iv => (
                  <button
                    key={iv.ms}
                    onClick={() => setLocalConfig({ ...localConfig, intervalMs: iv.ms })}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      localConfig.intervalMs === iv.ms
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {iv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk params */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Max Daily Loss (USDT)</label>
                <input
                  type="number"
                  value={localConfig.maxDailyLoss}
                  onChange={(e) => setLocalConfig({ ...localConfig, maxDailyLoss: e.target.value })}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Leverage</label>
                <input
                  type="number"
                  value={localConfig.lever}
                  min="1"
                  max="100"
                  onChange={(e) => setLocalConfig({ ...localConfig, lever: e.target.value })}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Strategy prompt */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Strategy Prompt</label>
              <textarea
                value={localConfig.prompt}
                onChange={(e) => setLocalConfig({ ...localConfig, prompt: e.target.value })}
                rows={8}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Strategy'}
            </button>
          </div>
        )}

        {tab === 'logs' && (
          <div className="p-2 flex flex-col gap-0.5 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">No logs yet. Start AI to see activity.</div>
            ) : (
              [...logs].reverse().map((log) => (
                <div
                  key={log.id}
                  className={`flex gap-2 py-1 px-2 rounded hover:bg-slate-800/50 ${LOG_COLORS[log.type]}`}
                >
                  <span className="opacity-60 flex-shrink-0">{LOG_ICONS[log.type]}</span>
                  <span className="text-slate-500 flex-shrink-0">
                    {new Date(log.ts).toLocaleTimeString()}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
