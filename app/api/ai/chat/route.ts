import { NextRequest, NextResponse } from 'next/server'
import { getOKXClient } from '@/lib/okx/client'
import type { SupportedPair, OKXBalance, OKXPosition, OKXCandle } from '@/lib/okx/types'

const MINIMAX_BASE = 'https://api.minimax.chat'
const MODEL = 'MiniMax-M2.5'

const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'place_order',
      description: 'Place a buy or sell order on OKX exchange',
      parameters: {
        type: 'object',
        properties: {
          instId: { type: 'string', description: 'e.g. ETH-USDT-SWAP, BTC-USDT' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          ordType: { type: 'string', enum: ['market', 'limit'] },
          sz: { type: 'string', description: 'contracts for SWAP, quantity for SPOT' },
          px: { type: 'string', description: 'price for limit orders' },
          tdMode: { type: 'string', enum: ['cross', 'isolated', 'cash'] },
          posSide: { type: 'string', enum: ['long', 'short', 'net'] },
          lever: { type: 'string', description: 'leverage 1-100' },
          tpTriggerPx: { type: 'string' },
          slTriggerPx: { type: 'string' },
        },
        required: ['instId', 'side', 'ordType', 'sz', 'tdMode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel an open order',
      parameters: {
        type: 'object',
        properties: {
          instId: { type: 'string' },
          ordId: { type: 'string' },
        },
        required: ['instId', 'ordId'],
      },
    },
  },
]

function buildContext(
  instId: string,
  ticker: { last: string; open24h: string; high24h: string; low24h: string; vol24h: string } | undefined,
  candles: OKXCandle[],
  positions: OKXPosition[],
  balance: OKXBalance[]
): string {
  const candleSummary = candles.slice(0, 10)
    .map(c => `O:${c.open} H:${c.high} L:${c.low} C:${c.close}`)
    .join(' | ')

  const posDetail = positions.length === 0
    ? '无持仓 (No positions)'
    : positions.map(p =>
        `【${p.instId}】方向:${p.posSide} 数量:${p.pos}张 开仓均价:${p.avgPx} 标记价:${p.markPx} 未实现盈亏:${p.upl}USDT 杠杆:${p.lever}x 强平价:${p.liqPx}`
      ).join('\n')

  const balDetail = balance.filter(b => parseFloat(b.bal) > 0)
    .map(b => `${b.ccy}: 总计${b.bal} 可用${b.availBal}`)
    .join(', ') || '无余额数据'

  return `## 市场数据 (${instId})
价格: ${ticker?.last ?? 'N/A'} | 24h高: ${ticker?.high24h ?? 'N/A'} | 24h低: ${ticker?.low24h ?? 'N/A'} | 成交量: ${ticker?.vol24h ?? 'N/A'}

## 最近K线 (最新在前)
${candleSummary || '无数据'}

## 当前持仓 (${positions.length}个)
${posDetail}

## 账户余额
${balDetail}`
}

type HistoryMsg = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      instId = 'ETH-USDT-SWAP',
      execute = false,
      history = [] as HistoryMsg[],
    } = await req.json()

    const client = getOKXClient()

    // Fetch all positions (not just current instId) for full context
    const [ticker, candles, positions, balance] = await Promise.all([
      client.getTicker(instId as SupportedPair).catch(() => undefined),
      client.getHistoricalKlines(instId, '5m', 20).catch(() => []),
      client.getPositions().catch(() => []),   // all positions
      client.getBalance().catch(() => []),       // all currencies
    ])

    const contextBlock = buildContext(
      instId,
      ticker ? { last: ticker.last, open24h: ticker.open24h, high24h: ticker.high24h, low24h: ticker.low24h, vol24h: ticker.vol24h } : undefined,
      candles,
      positions,
      balance
    )

    // Debug: log what we're sending to LLM
    console.log('[AI Chat] context snapshot:', {
      price: ticker?.last,
      balanceRaw: balance.map(b => ({ ccy: b.ccy, bal: b.bal, availBal: b.availBal })),
      posCount: positions.length,
    })
    console.log('[AI Chat] contextBlock:\n', contextBlock)

    const systemPrompt = `你是一个专业的加密货币交易助手，正在实时管理用户的OKX账户。

以下是**当前实时数据**，数据已由系统自动获取，请直接基于这些数据回答：

${contextBlock}

## 回答规则
- 上方数据是真实的实时账户数据，**直接引用数字回答**，不要说"无数据"或"未同步"
- 用户问余额时，直接报出"账户余额"里的数字
- 用户问持仓时，直接报出"当前持仓"里的详情  
- 分析行情时，结合K线和价格数据给出判断
- 回答简洁，数字保留2位小数
- 用中文回答（用户用英文提问则用英文）
- 只有用户明确说"下单"、"买入"、"卖出"时才执行交易`

    const messages = [
      { role: 'system', content: systemPrompt },
      // Include conversation history
      ...history.slice(-6).map((h: HistoryMsg) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const apiKey = process.env.MINIMAX_API_KEY
    if (!apiKey) throw new Error('MINIMAX_API_KEY not configured')

    const res = await fetch(`${MINIMAX_BASE}/v1/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        // Only pass tools when auto-execute is enabled
        ...(execute ? { tools: CHAT_TOOLS, tool_choice: 'auto' } : {}),
        temperature: 0.3,
        max_completion_tokens: 2000,
      }),
      cache: 'no-store',
    })

    const data = await res.json() as {
      choices?: {
        message?: {
          content?: string
          reasoning_content?: string
          tool_calls?: { function: { name: string; arguments: string } }[]
        }
      }[]
      base_resp?: { status_code: number; status_msg: string }
    }

    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`)
    }

    const message_resp = data.choices?.[0]?.message
    console.log('[AI Chat] raw response:', JSON.stringify({ content: message_resp?.content?.slice(0, 200), reasoning: message_resp?.reasoning_content?.slice(0, 200), tools: message_resp?.tool_calls?.length }))

    // Prefer content (the actual reply), fall back to reasoning_content
    const reply = message_resp?.content || message_resp?.reasoning_content || ''
    const toolCallsRaw = message_resp?.tool_calls ?? []

    // Execute tool calls if any
    const executed: { tool: string; result: string; success: boolean }[] = []
    for (const tc of toolCallsRaw) {
      let result = ''
      let success = false
      try {
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, string>
        if (tc.function.name === 'place_order') {
          const r = await client.placeOrder({
            instId: args.instId ?? instId,
            side: args.side as 'buy' | 'sell',
            ordType: (args.ordType ?? 'market') as 'market' | 'limit',
            sz: args.sz,
            px: args.px,
            tdMode: args.tdMode ?? 'cross',
            posSide: args.posSide as 'long' | 'short' | undefined,
            lever: args.lever ?? '5',
            tpTriggerPx: args.tpTriggerPx,
            slTriggerPx: args.slTriggerPx,
          })
          result = `订单已提交 ordId=${r[0]?.ordId ?? 'ok'}`
          success = true
        } else if (tc.function.name === 'cancel_order') {
          await client.cancelOrder(args.instId, args.ordId)
          result = '撤单成功'
          success = true
        }
      } catch (err) {
        result = err instanceof Error ? err.message : String(err)
        success = false
      }
      executed.push({ tool: tc.function.name, result, success })
    }

    return NextResponse.json({
      ok: true,
      data: {
        reply,
        toolCalls: toolCallsRaw.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })),
        executed,
        snapshot: {
          price: ticker?.last,
          positionsCount: positions.length,
          balance: balance.find(b => b.ccy === 'USDT')?.availBal,
        },
      },
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
