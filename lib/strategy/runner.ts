import { getOKXClient } from '@/lib/okx/client'
import { getAIDecision, type TradeToolCall, type MarketContext } from '@/lib/minimax/client'
import type { OKXCandle, SupportedPair, CandleInterval } from '@/lib/okx/types'

export interface StrategyConfig {
  prompt: string
  instId: SupportedPair
  bar: CandleInterval
  intervalMs: number
  maxPositionSize: string
  maxDailyLoss: string
  lever: string
  tdMode: 'cross' | 'isolated' | 'cash'
  enabled: boolean
}

export interface RunnerLog {
  id: string
  ts: string
  type: 'info' | 'decision' | 'trade' | 'error' | 'risk'
  message: string
  details?: unknown
}

export type LogHandler = (log: RunnerLog) => void

export const DEFAULT_STRATEGY: StrategyConfig = {
  prompt: `Trend-following strategy for ETH-USDT-SWAP.

Rules:
- Buy (long) when price is above 20-candle average and last candle is bullish (close > open)
- Sell (short) when price is below 20-candle average and last candle is bearish (close < open)
- Close positions when price reverses significantly (>1.5%)
- Position size: 1 contract per trade
- Use 5x leverage
- Set stop-loss 2% from entry price
- Only trade when confidence is high`,
  instId: 'ETH-USDT-SWAP',
  bar: '5m',
  intervalMs: 60000,
  maxPositionSize: '5',
  maxDailyLoss: '100',
  lever: '5',
  tdMode: 'cross',
  enabled: false,
}

class StrategyRunner {
  private config: StrategyConfig = { ...DEFAULT_STRATEGY }
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private dailyLoss = 0
  private lastDayReset = new Date().toDateString()
  private recentCandles: OKXCandle[] = []
  private logHandlers: LogHandler[] = []
  private logs: RunnerLog[] = []

  onLog(handler: LogHandler) {
    this.logHandlers.push(handler)
    return () => {
      this.logHandlers = this.logHandlers.filter(h => h !== handler)
    }
  }

  getLogs(): RunnerLog[] {
    return this.logs.slice(-200)
  }

  updateConfig(config: Partial<StrategyConfig>) {
    const wasEnabled = this.config.enabled
    this.config = { ...this.config, ...config }

    if (!wasEnabled && this.config.enabled) {
      this.start()
    } else if (wasEnabled && !this.config.enabled) {
      this.stop()
    } else if (this.config.enabled && config.intervalMs) {
      this.stop()
      this.start()
    }
  }

  getConfig(): StrategyConfig {
    return { ...this.config }
  }

  isRunning(): boolean {
    return this.running
  }

  private addLog(type: RunnerLog['type'], message: string, details?: unknown) {
    const log: RunnerLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      type,
      message,
      details,
    }
    this.logs.push(log)
    if (this.logs.length > 500) this.logs = this.logs.slice(-500)
    for (const h of this.logHandlers) h(log)
  }

  private checkDailyReset() {
    const today = new Date().toDateString()
    if (today !== this.lastDayReset) {
      this.dailyLoss = 0
      this.lastDayReset = today
    }
  }

  private async gatherContext(): Promise<MarketContext> {
    const client = getOKXClient()
    const [ticker, candles, positions, balance] = await Promise.all([
      client.getTicker(this.config.instId).catch(() => undefined),
      client.getHistoricalKlines(this.config.instId, this.config.bar, 50).catch(() => []),
      client.getPositions('SWAP', this.config.instId).catch(() => []),
      client.getBalance('USDT').catch(() => []),
    ])

    this.recentCandles = candles

    return {
      instId: this.config.instId,
      ticker: ticker
        ? {
            last: ticker.last,
            open24h: ticker.open24h,
            high24h: ticker.high24h,
            low24h: ticker.low24h,
            vol24h: ticker.vol24h,
          }
        : undefined,
      recentCandles: candles,
      positions,
      balance,
    }
  }

  private async executeToolCall(tool: TradeToolCall): Promise<string> {
    const client = getOKXClient()

    if (tool.name === 'no_action') {
      return `No action: ${(tool.arguments as { reason: string }).reason}`
    }

    if (tool.name === 'get_positions') {
      const positions = await client.getPositions(
        undefined,
        tool.arguments.instId as string | undefined
      )
      return JSON.stringify(positions)
    }

    if (tool.name === 'get_balance') {
      const balance = await client.getBalance(tool.arguments.ccy as string | undefined)
      return JSON.stringify(balance)
    }

    if (tool.name === 'cancel_order') {
      const result = await client.cancelOrder(
        tool.arguments.instId as string,
        tool.arguments.ordId as string
      )
      return JSON.stringify(result)
    }

    if (tool.name === 'place_order') {
      this.checkDailyReset()
      if (this.dailyLoss >= parseFloat(this.config.maxDailyLoss)) {
        this.addLog('risk', `Daily loss limit reached ($${this.dailyLoss}). Order blocked.`)
        return 'BLOCKED: Daily loss limit reached'
      }

      const args = tool.arguments as Record<string, string>
      const result = await client.placeOrder({
        instId: args.instId,
        side: args.side as 'buy' | 'sell',
        ordType: args.ordType as 'market' | 'limit',
        sz: args.sz,
        px: args.px,
        tdMode: args.tdMode ?? this.config.tdMode,
        posSide: args.posSide as 'long' | 'short' | undefined,
        lever: args.lever ?? this.config.lever,
        tpTriggerPx: args.tpTriggerPx,
        slTriggerPx: args.slTriggerPx,
      })
      return JSON.stringify(result)
    }

    return 'Unknown tool'
  }

  private async runCycle() {
    if (!this.config.enabled) return

    this.addLog('info', `Running AI cycle for ${this.config.instId}`)

    try {
      const context = await this.gatherContext()
      const decision = await getAIDecision(this.config.prompt, context)

      this.addLog('decision', decision.reasoning || 'AI made a decision', {
        toolCalls: decision.toolCalls,
      })

      for (const tool of decision.toolCalls) {
        if (tool.name === 'no_action') {
          this.addLog('info', `No action: ${(tool.arguments as { reason?: string }).reason ?? 'unspecified'}`)
          continue
        }

        try {
          const result = await this.executeToolCall(tool)
          this.addLog('trade', `Executed ${tool.name}`, {
            args: tool.arguments,
            result,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          this.addLog('error', `Tool ${tool.name} failed: ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.addLog('error', `Cycle error: ${msg}`)
    }
  }

  private scheduleNext() {
    if (!this.config.enabled) return
    this.timer = setTimeout(async () => {
      await this.runCycle()
      this.scheduleNext()
    }, this.config.intervalMs)
  }

  start() {
    if (this.running) return
    this.running = true
    this.addLog('info', `Strategy runner started (interval: ${this.config.intervalMs / 1000}s)`)
    this.runCycle().then(() => this.scheduleNext())
  }

  stop() {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.addLog('info', 'Strategy runner stopped')
  }
}

let _runner: StrategyRunner | null = null

export function getStrategyRunner(): StrategyRunner {
  if (!_runner) {
    _runner = new StrategyRunner()
  }
  return _runner
}

export { StrategyRunner }
