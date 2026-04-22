'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'

const CHUNK_RETRY_COUNT_KEY = 'mirakl_chunk_retry_count'
const CHUNK_RETRY_TS_KEY = 'mirakl_chunk_retry_ts'
const CHUNK_RETRY_PARAM = '_chunk_retry'
const CHUNK_MAX_RETRIES = 3
const CHUNK_RETRY_WINDOW_MS = 20000

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  useEffect(() => {
    const shouldHandleChunkError = (message: string) =>
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('originalFactory.call') ||
      message.includes("is not an object (evaluating 'originalFactory.call')") ||
      message.includes("Cannot read properties of undefined (reading 'call')")

    const handleReload = () => {
      const now = Date.now()
      const lastAttemptAt = Number(sessionStorage.getItem(CHUNK_RETRY_TS_KEY) || '0')
      const currentCount = Number(sessionStorage.getItem(CHUNK_RETRY_COUNT_KEY) || '0')
      const nextCount = now - lastAttemptAt < CHUNK_RETRY_WINDOW_MS ? currentCount + 1 : 1

      if (nextCount > CHUNK_MAX_RETRIES) {
        sessionStorage.removeItem(CHUNK_RETRY_COUNT_KEY)
        sessionStorage.removeItem(CHUNK_RETRY_TS_KEY)
        return
      }

      sessionStorage.setItem(CHUNK_RETRY_COUNT_KEY, String(nextCount))
      sessionStorage.setItem(CHUNK_RETRY_TS_KEY, String(now))

      const url = new URL(window.location.href)
      url.searchParams.set(CHUNK_RETRY_PARAM, String(now))
      window.location.replace(url.toString())
    }

    const onError = (event: ErrorEvent) => {
      const message = event.message || (event.error as Error | undefined)?.message || ''
      if (shouldHandleChunkError(message)) {
        handleReload()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        (typeof reason === 'object' && reason && 'message' in reason && typeof reason.message === 'string'
          ? reason.message
          : String(reason || '')) || ''

      if (shouldHandleChunkError(message)) {
        handleReload()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    const cleanRetryParam = () => {
      const url = new URL(window.location.href)
      if (!url.searchParams.has(CHUNK_RETRY_PARAM)) return
      url.searchParams.delete(CHUNK_RETRY_PARAM)
      window.history.replaceState({}, '', url.toString())
    }

    cleanRetryParam()

    const resetReloadFlagTimeout = window.setTimeout(() => {
      sessionStorage.removeItem(CHUNK_RETRY_COUNT_KEY)
      sessionStorage.removeItem(CHUNK_RETRY_TS_KEY)
    }, 4000)

    return () => {
      window.clearTimeout(resetReloadFlagTimeout)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef3f9_100%)]">
      <Sidebar onExpandedChange={setSidebarExpanded} />
      {/* Margin synced with sidebar width: w-20 (80px) collapsed, w-64 (256px) expanded */}
      <main
        className={`min-h-screen transition-[margin] duration-300 ease-out ${
          sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
