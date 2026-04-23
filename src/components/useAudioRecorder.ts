'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopping'

export type AudioRecorderHook = {
  state: RecorderState
  isSupported: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<Blob | null>
  cancel: () => void
  durationMs: number
}

function pickMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

export function useAudioRecorder(): AudioRecorderHook {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined'
    )
  }, [])

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    startedAtRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError(null)
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type })
          : null
        const resolver = stopResolverRef.current
        stopResolverRef.current = null
        cleanup()
        setState('idle')
        setDurationMs(0)
        resolver?.(blob)
      }
      recorder.onerror = (event) => {
        const err = (event as Event & { error?: Error }).error
        setError(err?.message ?? 'Recording error')
        cleanup()
        setState('idle')
      }

      recorder.start(250)
      startedAtRef.current = Date.now()
      setDurationMs(0)
      tickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setDurationMs(Date.now() - startedAtRef.current)
        }
      }, 200)
      setState('recording')
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === 'NotAllowedError'
            ? 'Microphone permission denied.'
            : err.message
          : 'Unable to access microphone.'
      setError(msg)
      cleanup()
      setState('idle')
    }
  }, [state, cleanup])

  const stop = useCallback((): Promise<Blob | null> => {
    if (state !== 'recording') return Promise.resolve(null)
    const recorder = mediaRecorderRef.current
    if (!recorder) return Promise.resolve(null)
    setState('stopping')
    return new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve
      try {
        recorder.stop()
      } catch {
        resolve(null)
        cleanup()
        setState('idle')
      }
    })
  }, [state, cleanup])

  const cancel = useCallback(() => {
    stopResolverRef.current = null
    const recorder = mediaRecorderRef.current
    try {
      recorder?.stop()
    } catch {
      /* noop */
    }
    cleanup()
    setState('idle')
    setDurationMs(0)
  }, [cleanup])

  useEffect(() => () => cleanup(), [cleanup])

  return { state, isSupported, error, start, stop, cancel, durationMs }
}
