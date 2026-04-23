'use client'

// MIRA — subscribe to decision_ledger INSERT/UPDATE events on Supabase Realtime.
// Loads an initial snapshot via /api/mira/ledger, then streams changes in.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export type MiraDecision = {
  id: string
  sku: string | null
  channel: string | null
  action_type: string
  template_id: string
  logical_inference: string
  raw_payload?: unknown
  status: string
  reversible: boolean
  source_agent: string | null
  triggered_by: string | null
  trigger_event_id: string | null
  created_at: string
  executed_at: string | null
  founder_decision_at: string | null
}

type LedgerState = {
  decisions: MiraDecision[]
  loading: boolean
  realtimeConnected: boolean
  error: string | null
}

export function useMiraLedger(limit = 20): LedgerState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<LedgerState>({
    decisions: [],
    loading: true,
    realtimeConnected: false,
    error: null,
  })
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/mira/ledger?limit=${limit}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`ledger fetch ${response.status}`)
      const data = await response.json()
      if (!mountedRef.current) return
      setState((s) => ({ ...s, decisions: data.decisions ?? [], loading: false, error: null }))
    } catch (error) {
      if (!mountedRef.current) return
      setState((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : 'Load failed',
      }))
    }
  }, [limit])

  useEffect(() => {
    mountedRef.current = true
    refresh()

    const client = getSupabaseBrowserClient()
    if (!client) return

    const channel = client
      .channel('mira-decision-ledger')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'decision_ledger' },
        (payload) => {
          if (!mountedRef.current) return
          const row = payload.new as MiraDecision
          setState((s) => ({
            ...s,
            decisions: [row, ...s.decisions].slice(0, limit),
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'decision_ledger' },
        (payload) => {
          if (!mountedRef.current) return
          const updated = payload.new as MiraDecision
          setState((s) => ({
            ...s,
            decisions: s.decisions.map((d) => (d.id === updated.id ? updated : d)),
          }))
        },
      )
      .subscribe((status) => {
        if (!mountedRef.current) return
        setState((s) => ({ ...s, realtimeConnected: status === 'SUBSCRIBED' }))
      })

    return () => {
      mountedRef.current = false
      client.removeChannel(channel)
    }
  }, [limit, refresh])

  return { ...state, refresh }
}
