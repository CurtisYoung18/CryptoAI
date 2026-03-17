import axios from 'axios'
import type { OKXBalance, OKXPosition, OKXCandle } from '@/lib/okx/types'

const MINIMAX_BASE = 'https://api.minimax.io'
const MODEL = 'MiniMax-M2.5'

export interface TradeToolCall {
  name: 'place_order' | 'cancel_order' | 'get_positions' | 'get_balance' | 'no_action'
  arguments: Record<string, unknown>
}

export interface AIDecision {
  reasoning: string
  toolCalls: TradeToolCall[]
  rawContent: string
}

const TRADING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'place_order',
      description: 'Place a buy or sell order on OKX',
      parameters: {
        type: 'object',
        properties: {
          instId: {
            type: 'string',
            description: 'Instrument ID, e.g. ETH-USDT-SWAP, BTC-USDT',
          },
          side: { type: 'string', enum: ['buy', 'sell'] },
          ordType: { type: 'string', enum: ['market', 'limit'] },
          sz: { type: 'string', description: 'Order size (contracts for SWAP, quantity for SPOT)' },
          px: { type: 'string', description: 'Price (required for limit orders)' },
          tdMode: {
            type: 'string',
            enum: ['cross', 'isolated', 'cash'],
            description: 'Trade mode: cross/isolated for SWAP, cash for SPOT',
          },
          posSide: {
            type: 'string',
            enum: ['long', 'short', 'net'],
            description: 'Position side for SWAP contracts',
          },
          lever: { type: 'string', description: 'Leverage (1-100 for SWAP)' },
          tpTriggerPx: { type: 'string', description: 'Take profit trigger price' },
          slTriggerPx: { type: 'string', description: 'Stop loss trigger price' },
        },
        required: ['instId', 'side', 'ordType', 'sz', 'tdMode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel an existing open order',
      parameters: {
        type: 'object',
        properties: {
          instId: { type: 'string' },
          ordId: { type: 'string', description: 'Order ID to cancel' },
        },
        required: ['instId', 'ordId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_positions',
      description: 'Get current open positions',
      parameters: {
        type: 'object',
        properties: {
          instId: { type: 'string', description: 'Filter by instrument ID (optional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_balance',
      description: 'Get account balance',
      parameters: {
        type: 'object',
        properties: {
          ccy: { type: 'string', description: 'Currency filter, e.g. USDT' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'no_action',
      description: 'Take no trading action this cycle',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason for not acting' },
        },
        required: ['reason'],
      },
    },
  },
]

export interface MarketContext {
  instId: string
  ticker?: { last: string; open24h: string; high24h: string; low24h: string; vol24h: string }
  recentCandles?: OKXCandle[]
  positions?: OKXPosition[]
  balance?: OKXBalance[]
}

function buildSystemPrompt(strategy: string, context: MarketContext): string {
  const candleSummary = context.recentCandles
    ?.slice(0, 10)
    .map(c => `O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.vol}`)
    .join(' | ')

  const positionSummary = context.positions
    ?.map(p => `${p.instId} ${p.posSide} size=${p.pos} entry=${p.avgPx} upl=${p.upl}`)
    .join(', ') || 'No open positions'

  const balanceSummary = context.balance
    ?.filter(b => parseFloat(b.bal) > 0)
    .map(b => `${b.ccy}: ${b.bal} (avail: ${b.availBal})`)
    .join(', ') || 'Balance unavailable'

  return `You are an AI crypto trading assistant managing an OKX account.

## Current Market Data (${context.instId})
${context.ticker ? `Price: ${context.ticker.last} | 24h: O=${context.ticker.open24h} H=${context.ticker.high24h} L=${context.ticker.low24h} Vol=${context.ticker.vol24h}` : 'No ticker data'}

## Recent Candles (newest first)
${candleSummary || 'No candle data'}

## Current Positions
${positionSummary}

## Account Balance
${balanceSummary}

## Trading Strategy
${strategy}

## Rules
- Always call exactly one tool per response
- Use no_action with a reason if conditions are not met
- Respect position sizing and risk limits in the strategy
- For SWAP instruments use tdMode=cross or isolated
- For SPOT instruments use tdMode=cash
- Always include your reasoning in natural language before calling a tool`
}

export async function getAIDecision(
  strategy: string,
  context: MarketContext,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<AIDecision> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY not configured')

  const systemPrompt = buildSystemPrompt(strategy, context)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    {
      role: 'user',
      content: `Current time: ${new Date().toISOString()}. Analyze the market and decide what action to take based on the strategy. Call the appropriate tool.`,
    },
  ]

  const res = await axios.post(
    `${MINIMAX_BASE}/v1/text/chatcompletion_v2`,
    {
      model: MODEL,
      messages,
      tools: TRADING_TOOLS,
      tool_choice: 'required',
      temperature: 0.2,
      max_completion_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  )

  const choice = res.data.choices?.[0]
  const message = choice?.message

  const toolCalls: TradeToolCall[] = []

  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      try {
        toolCalls.push({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })
      } catch {}
    }
  }

  return {
    reasoning: message?.content || '',
    toolCalls,
    rawContent: JSON.stringify(message),
  }
}
