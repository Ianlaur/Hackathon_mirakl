import './globals.css'
import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'
import { SidebarProvider } from '@/contexts/SidebarContext'

export const metadata: Metadata = {
  title: 'Hackathon Mirakl',
  description: 'Hackathon dashboard and inventory workspace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>
          <AppShell>{children}</AppShell>
        </SidebarProvider>
      </body>
    </html>
  )
}
