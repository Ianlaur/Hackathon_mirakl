import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'MIRAKL CONNECT',
  description: 'Mirakl Connect Operations Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#F2F8FF] font-serif text-[#191b24] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
