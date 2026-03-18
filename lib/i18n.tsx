'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type Lang = 'zh' | 'en'

const translations = {
  zh: {
    appName: 'OKX AI 交易面板',
    poweredBy: '由 MiniMax-M2.5 驱动',
    refresh: '刷新',
    modeManual: '手动',
    modeHybrid: '混合',
    modeAI: 'AI 自动',
    modeManualDesc: '完全手动控制',
    modeHybridDesc: 'AI 建议，人工确认',
    modeAIDesc: 'AI 自主交易',
    configMissing: '未配置 OKX 凭证。请将 .env.local.example 复制为 .env.local 并填入 API Keys，然后重启。',
    balance: '余额',
    available: '可用',
    tabTrade: '手动交易',
    tabAI: 'AI 引擎',
    mode: '模式',
    pair: '交易对',
    interval: '周期',
    // ManualTradePanel
    manualTrade: '手动下单',
    aiModeActive: 'AI 自动模式已激活 — 切换到手动或混合模式才能手动下单',
    orderType: '订单类型',
    market: '市价',
    limit: '限价',
    size: '数量',
    contracts: '张',
    quantity: '数量',
    limitPrice: '限价',
    last: '最新',
    leverage: '杠杆',
    marginMode: '保证金模式',
    cross: '全仓',
    isolated: '逐仓',
    takeProfit: '止盈',
    stopLoss: '止损',
    optional: '可选',
    placing: '下单中...',
    enterValidSize: '请输入有效数量',
    enterValidPrice: '请输入有效限价',
    orderPlaced: '下单成功',
    orderFailed: '下单失败',
    // PositionTable
    positions: '持仓',
    noPositions: '暂无持仓',
    instrument: '合约',
    side: '方向',
    sizeCol: '数量',
    avgEntry: '开仓均价',
    markPrice: '标记价',
    upl: '未实现盈亏',
    uplPct: '盈亏%',
    liq: '强平价',
    close: '平仓',
    long: '做多',
    short: '做空',
    // AIControlPanel
    startAI: '启动 AI',
    stopAI: '停止 AI',
    strategyConfig: '策略配置',
    logs: '日志',
    noLogs: '暂无日志，启动 AI 后显示活动记录',
    instrumentLabel: '交易品种',
    candleBar: 'K线周期',
    aiCycleInterval: 'AI 决策间隔',
    maxDailyLoss: '每日最大亏损 (USDT)',
    leverageLabel: '杠杆倍数',
    strategyPrompt: '策略 Prompt',
    saveStrategy: '保存策略',
    saving: '保存中...',
    buy: '买入',
    sell: '卖出',
    sizeMode: '数量模式',
    sizeModeContracts: '按张数',
    sizeModeUsdt: '按USDT',
    usdtAmount: 'USDT金额',
    calcContracts: '≈ {n} 张',
    layoutClassic: '经典',
    layoutSimple: '简洁',
    aiChat: 'AI 对话',
    aiChatPlaceholder: '输入策略指令，例如：用10 USDT买入ETH做多，5倍杠杆...',
    aiChatSend: '发送',
    aiChatSending: '思考中...',
    aiChatHint: 'AI 会分析当前市场并执行操作',
  },
  en: {
    appName: 'OKX AI Trading',
    poweredBy: 'powered by MiniMax-M2.5',
    refresh: 'Refresh',
    modeManual: 'Manual',
    modeHybrid: 'Hybrid',
    modeAI: 'AI Auto',
    modeManualDesc: 'Full manual control',
    modeHybridDesc: 'AI suggests, you confirm',
    modeAIDesc: 'AI trades autonomously',
    configMissing: 'OKX credentials not configured. Copy .env.local.example to .env.local and add your API keys, then restart.',
    balance: 'Balance',
    available: 'avail',
    tabTrade: 'Trade',
    tabAI: 'AI Engine',
    mode: 'Mode',
    pair: 'Pair',
    interval: 'Interval',
    // ManualTradePanel
    manualTrade: 'Manual Trade',
    aiModeActive: 'AI Mode active — switch to Manual or Hybrid to trade manually',
    orderType: 'Order Type',
    market: 'Market',
    limit: 'Limit',
    size: 'Size',
    contracts: 'contracts',
    quantity: 'quantity',
    limitPrice: 'Limit Price',
    last: 'Last',
    leverage: 'Leverage',
    marginMode: 'Margin Mode',
    cross: 'Cross',
    isolated: 'Isolated',
    takeProfit: 'Take Profit',
    stopLoss: 'Stop Loss',
    optional: 'Optional',
    placing: 'Placing...',
    enterValidSize: 'Enter a valid size',
    enterValidPrice: 'Enter a valid limit price',
    orderPlaced: 'Order placed',
    orderFailed: 'Order failed',
    // PositionTable
    positions: 'Positions',
    noPositions: 'No open positions',
    instrument: 'Instrument',
    side: 'Side',
    sizeCol: 'Size',
    avgEntry: 'Avg Entry',
    markPrice: 'Mark',
    upl: 'UPL',
    uplPct: 'UPL%',
    liq: 'Liq',
    close: 'Close',
    long: 'LONG',
    short: 'SHORT',
    // AIControlPanel
    startAI: 'Start AI',
    stopAI: 'Stop AI',
    strategyConfig: 'Strategy Config',
    logs: 'Logs',
    noLogs: 'No logs yet. Start AI to see activity.',
    instrumentLabel: 'Instrument',
    candleBar: 'Candle Bar',
    aiCycleInterval: 'AI Cycle Interval',
    maxDailyLoss: 'Max Daily Loss (USDT)',
    leverageLabel: 'Leverage',
    strategyPrompt: 'Strategy Prompt',
    saveStrategy: 'Save Strategy',
    saving: 'Saving...',
    buy: 'BUY',
    sell: 'SELL',
    sizeMode: 'Size Mode',
    sizeModeContracts: 'Contracts',
    sizeModeUsdt: 'USDT',
    usdtAmount: 'USDT Amount',
    calcContracts: '≈ {n} contracts',
    layoutClassic: 'Classic',
    layoutSimple: 'Focus',
    aiChat: 'AI Chat',
    aiChatPlaceholder: 'Type strategy command, e.g.: buy ETH long with 10 USDT at 5x leverage...',
    aiChatSend: 'Send',
    aiChatSending: 'Thinking...',
    aiChatHint: 'AI will analyze market and execute actions',
  },
}

type T = typeof translations.en

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: T
}

const LangContext = createContext<LangContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: translations.zh,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh')
  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
