import type { Metadata } from 'next'
import './globals.css'
import { LangProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'OKX AI Trading Panel',
  description: 'AI-powered OKX trading control panel with MiniMax-M2.5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  )
}
