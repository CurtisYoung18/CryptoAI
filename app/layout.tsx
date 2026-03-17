import type { Metadata } from 'next'
import './globals.css'

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
        {children}
      </body>
    </html>
  )
}
