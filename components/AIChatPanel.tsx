'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTradingStore } from '@/store/trading'
import { useLang } from '@/lib/i18n'

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  toolCalls?: { name: string; arguments: Record<string, unknown> }[]
  executed?: { tool: string; result: string; success: boolean }[]
  snapshot?: { price?: string; positionsCount?: number; balance?: string }
  ts: number
}
type HistoryMsg = { role: 'user' | 'assistant'; content: string }

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      p: ({ children }) => <p style={{ marginBottom: '0.5em', lineHeight: 1.6 }}>{children}</p>,
      h1: ({ children }) => <h1 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, marginTop: 12, color: 'var(--c-t1)' }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, marginTop: 10, color: 'var(--c-t1)' }}>{children}</h2>,
      h3: ({ children }) => <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, marginTop: 8, color: 'var(--c-t2)' }}>{children}</h3>,
      ul: ({ children }) => <ul style={{ paddingLeft: 16, marginBottom: 6, lineHeight: 1.7 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ paddingLeft: 16, marginBottom: 6, lineHeight: 1.7 }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
      strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--c-t1)' }}>{children}</strong>,
      em: ({ children }) => <em style={{ color: 'var(--c-t2)' }}>{children}</em>,
      code: ({ children, className }) => className?.includes('language-')
        ? <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#86efac', margin: '6px 0', overflowX: 'auto', lineHeight: 1.6 }}>{children}</code>
        : <code style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 4, padding: '1px 5px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#86efac' }}>{children}</code>,
      pre: ({ children }) => <pre style={{ margin: '6px 0' }}>{children}</pre>,
      blockquote: ({ children }) => <blockquote style={{ borderLeft: '2px solid var(--c-blue)', paddingLeft: 10, margin: '6px 0', color: 'var(--c-t2)' }}>{children}</blockquote>,
      table: ({ children }) => (
        <div style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>{children}</table>
        </div>
      ),
      th: ({ children }) => <th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', fontWeight: 600, textAlign: 'left' }}>{children}</th>,
      td: ({ children }) => <td style={{ border: '1px solid rgba(255,255,255,0.07)', padding: '4px 8px', color: 'var(--c-t2)' }}>{children}</td>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--c-blue)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>,
      hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />,
    }}>
      {content}
    </ReactMarkdown>
  )
}

const QUICK = [
  { label: '分析行情', cmd: '分析当前市场行情，给出是否值得交易的判断' },
  { label: '查持仓', cmd: '查询我的当前所有持仓和未实现盈亏详情' },
  { label: '查余额', cmd: '查询我的账户余额' },
  { label: '策略建议', cmd: '根据当前价格走势，给我一个具体的交易策略建议，包括入场价、止损和止盈' },
]

export default function AIChatPanel() {
  const { selectedPair } = useTradingStore()
  const { t } = useLang()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoExecute, setAutoExecute] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const buildHistory = (msgs: ChatMessage[]): HistoryMsg[] =>
    msgs.slice(-8).flatMap(m =>
      m.role === 'user' ? [{ role: 'user' as const, content: m.content }]
      : m.content ? [{ role: 'assistant' as const, content: m.content }]
      : []
    )

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: msg, ts: Date.now() }
    setMessages(prev => {
      const next = [...prev, userMsg]
      request(msg, buildHistory(next.slice(0, -1)))
      return next
    })
    setInput('')
  }

  const request = async (msg: string, history: HistoryMsg[]) => {
    setLoading(true)
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, instId: selectedPair, execute: autoExecute, history }),
      })
      const json = await r.json()
      if (json.ok) {
        const d = json.data
        setMessages(p => [...p, {
          id: `ai-${Date.now()}`, role: 'ai',
          content: d.reply || '(no response)',
          toolCalls: d.toolCalls?.length > 0 ? d.toolCalls : undefined,
          executed: d.executed?.length > 0 ? d.executed : undefined,
          snapshot: d.snapshot, ts: Date.now(),
        }])
      } else {
        setMessages(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: `错误: ${json.error}`, ts: Date.now() }])
      }
    } catch (e) {
      setMessages(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: `网络错误: ${String(e)}`, ts: Date.now() }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--c-card)', borderRadius: 12,
      border: '1px solid var(--c-border)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', flexShrink: 0,
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-raise)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-blue)', boxShadow: '0 0 6px var(--c-blue)' }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-t1)' }}>{t.aiChat}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--c-t3)', background: 'var(--c-card)', padding: '1px 6px', borderRadius: 4 }}>
            {selectedPair}
          </span>
        </div>

        <button onClick={() => setAutoExecute(!autoExecute)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: autoExecute ? 'var(--c-green-d)' : 'var(--c-raise)',
          border: `1px solid ${autoExecute ? 'rgba(34,197,94,0.25)' : 'var(--c-border2)'}`,
          color: autoExecute ? 'var(--c-green)' : 'var(--c-t3)',
          transition: 'all 0.15s', cursor: 'pointer',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: autoExecute ? 'var(--c-green)' : 'rgba(255,255,255,0.2)',
          }} />
          {autoExecute ? '自动执行' : '仅分析'}
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '40px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🤖</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-t2)', marginBottom: 4 }}>{t.aiChatHint}</div>
              <div style={{ fontSize: 12, color: 'var(--c-t4)' }}>{t.aiChatPlaceholder}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 360 }}>
              {QUICK.map(q => (
                <button key={q.label} onClick={() => send(q.cmd)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: 'var(--c-raise)', border: '1px solid var(--c-border2)',
                  color: 'var(--c-t2)', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-card)'; e.currentTarget.style.color = 'var(--c-t1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-raise)'; e.currentTarget.style.color = 'var(--c-t2)' }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                : 'var(--c-raise)',
              border: msg.role === 'ai' ? '1px solid var(--c-border2)' : 'none',
              color: msg.role === 'user' ? '#fff' : 'var(--c-t2)',
              fontWeight: 600,
            }}>
              {msg.role === 'user' ? '你' : '⚡'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '84%', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {/* Snapshot */}
              {msg.role === 'ai' && msg.snapshot && (msg.snapshot.price || msg.snapshot.balance) && (
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--c-t3)', padding: '3px 0' }}>
                  {msg.snapshot.price && <span>价格 <span style={{ color: 'var(--c-t2)' }}>${parseFloat(msg.snapshot.price).toLocaleString()}</span></span>}
                  {msg.snapshot.balance && <span>余额 <span style={{ color: 'var(--c-green)' }}>${parseFloat(msg.snapshot.balance).toFixed(2)}</span></span>}
                  {msg.snapshot.positionsCount !== undefined && <span>持仓 <span style={{ color: 'var(--c-t2)' }}>{msg.snapshot.positionsCount}</span></span>}
                </div>
              )}

              {/* Bubble */}
              <div style={{
                padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                ...(msg.role === 'user' ? {
                  background: 'var(--c-blue)',
                  color: '#fff',
                  borderBottomRightRadius: 4,
                } : {
                  background: 'var(--c-raise)',
                  color: 'var(--c-t1)',
                  border: '1px solid var(--c-border)',
                  borderBottomLeftRadius: 4,
                }),
              }}>
                {msg.role === 'user'
                  ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  : <Markdown content={msg.content} />}

                {/* Tool calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {msg.toolCalls.map((tc, i) => {
                      const a = tc.arguments as Record<string, string>
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, padding: '4px 8px', borderRadius: 6,
                          background: tc.name === 'place_order' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}>
                          <span style={{ color: 'var(--c-t4)' }}>→</span>
                          {tc.name === 'place_order'
                            ? <span style={{ color: 'var(--c-blue)' }}>{a.side?.toUpperCase()} {a.instId ?? selectedPair} sz={a.sz}{a.lever ? ` · ${a.lever}x` : ''}</span>
                            : <span style={{ color: 'var(--c-t2)' }}>{tc.name}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Executed */}
                {msg.executed && msg.executed.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {msg.executed.map((ex, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: ex.success ? 'var(--c-green)' : 'var(--c-red)' }}>
                        {ex.success ? '✓' : '✗'} {ex.result.length > 80 ? ex.result.slice(0, 80) + '…' : ex.result}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span style={{ fontSize: 10, color: 'var(--c-t4)', padding: '0 3px' }}>
                {new Date(msg.ts).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              background: 'var(--c-raise)', border: '1px solid var(--c-border2)', color: 'var(--c-t2)',
            }}>⚡</div>
            <div style={{
              padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4,
              background: 'var(--c-raise)', border: '1px solid var(--c-border)',
            }}>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                {[0, 150, 300].map(d => (
                  <span key={d} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--c-t3)',
                    animation: 'bounce 1s infinite',
                    animationDelay: `${d}ms`,
                  }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick cmds (when msgs exist) */}
      {messages.length > 0 && !loading && (
        <div style={{
          flexShrink: 0, padding: '6px 12px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex', gap: 6, overflowX: 'auto',
        }}>
          {QUICK.map(q => (
            <button key={q.label} onClick={() => send(q.cmd)} style={{
              flexShrink: 0, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              background: 'transparent', border: '1px solid var(--c-border2)',
              color: 'var(--c-t3)', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-t1)'; e.currentTarget.style.borderColor = 'var(--c-border2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-t3)'; e.currentTarget.style.borderColor = 'var(--c-border2)' }}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '8px 12px 10px' }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--c-raise)', borderRadius: 10,
          border: '1px solid var(--c-border2)', padding: '8px 8px 8px 12px',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--c-border2)')}>
          <textarea
            ref={taRef} value={input} rows={2}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={t.aiChatPlaceholder}
            disabled={loading}
            style={{
              flex: 1, background: 'transparent', border: 'none', boxShadow: 'none',
              resize: 'none', fontSize: 13, lineHeight: 1.5,
              color: 'var(--c-t1)', outline: 'none', padding: 0,
              fontFamily: 'inherit',
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: input.trim() && !loading ? 'var(--c-blue)' : 'rgba(255,255,255,0.06)',
            color: input.trim() && !loading ? '#fff' : 'var(--c-t4)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.15s', border: 'none',
          }}>
            {loading
              ? <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--c-t4)', marginTop: 4, paddingLeft: 2 }}>⏎ 发送 · ⇧⏎ 换行</div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
