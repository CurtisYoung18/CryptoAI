import { create } from 'zustand'
import type { TradingMode, OKXBalance, OKXPosition, SupportedPair, CandleInterval } from '@/lib/okx/types'
import type { RunnerLog, StrategyConfig } from '@/lib/strategy/runner'
import { DEFAULT_STRATEGY } from '@/lib/strategy/runner'

export interface TickerData {
  instId: string
  last: string
  change24h: string
  high24h: string
  low24h: string
  vol24h: string
}

interface TradingStore {
  // Mode
  mode: TradingMode
  setMode: (mode: TradingMode) => void

  // Selected pair/timeframe
  selectedPair: SupportedPair
  selectedBar: CandleInterval
  setSelectedPair: (pair: SupportedPair) => void
  setSelectedBar: (bar: CandleInterval) => void

  // Account data
  balances: OKXBalance[]
  positions: OKXPosition[]
  setBalances: (b: OKXBalance[]) => void
  setPositions: (p: OKXPosition[]) => void

  // Tickers
  tickers: Record<string, TickerData>
  updateTicker: (instId: string, data: Partial<TickerData>) => void

  // AI strategy
  strategyConfig: StrategyConfig
  setStrategyConfig: (config: Partial<StrategyConfig>) => void
  aiRunning: boolean
  setAiRunning: (v: boolean) => void

  // AI logs
  logs: RunnerLog[]
  addLog: (log: RunnerLog) => void
  clearLogs: () => void

  // Pending AI action (for Hybrid mode)
  pendingAction: { toolName: string; args: Record<string, unknown> } | null
  setPendingAction: (action: { toolName: string; args: Record<string, unknown> } | null) => void
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  mode: 'manual',
  setMode: (mode) => set({ mode }),

  selectedPair: 'ETH-USDT-SWAP',
  selectedBar: '5m',
  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSelectedBar: (bar) => set({ selectedBar: bar }),

  balances: [],
  positions: [],
  setBalances: (balances) => set({ balances }),
  setPositions: (positions) => set({ positions }),

  tickers: {},
  updateTicker: (instId, data) =>
    set((state) => ({
      tickers: {
        ...state.tickers,
        [instId]: { ...state.tickers[instId], instId, ...data },
      },
    })),

  strategyConfig: { ...DEFAULT_STRATEGY },
  setStrategyConfig: (config) =>
    set((state) => ({ strategyConfig: { ...state.strategyConfig, ...config } })),
  aiRunning: false,
  setAiRunning: (v) => set({ aiRunning: v }),

  logs: [],
  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs.slice(-199), log],
    })),
  clearLogs: () => set({ logs: [] }),

  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),
}))
