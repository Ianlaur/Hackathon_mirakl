import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import { JetBrains_Mono, Roboto_Serif } from 'next/font/google'
import AppShell from '@/components/AppShell'

const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-roboto-serif',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

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
      <head />
      <body className={`${robotoSerif.variable} ${jetBrainsMono.variable} bg-[#F2F8FF] font-serif text-[#03182F] antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
