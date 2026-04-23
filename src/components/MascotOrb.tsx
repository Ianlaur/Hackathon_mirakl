'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import MascotChatDrawer from './MascotChatDrawer'

const POSITION_STORAGE_KEY = 'mira_orb_position_v1'
const DESKTOP_MIN_X = 120
const DESKTOP_MIN_Y = 88
const SPEECH_LINES = [
  'Hi, I am Mira. Ask me anything about your operations.',
  'Need a quick action plan? I can prepare one.',
  'I can help with stock, transport and planning decisions.',
]

type Position = { x: number; y: number }

function getMinX() {
  if (typeof window === 'undefined') return 8
  return window.innerWidth >= 1024 ? DESKTOP_MIN_X : 8
}

function getMinY() {
  if (typeof window === 'undefined') return 8
  return window.innerWidth >= 1024 ? DESKTOP_MIN_Y : 8
}

function getOrbSize() {
  if (typeof window === 'undefined') return 96
  return window.innerWidth >= 1024 ? 112 : 96
}

function clampPosition(position: Position, orbSize: number) {
  if (typeof window === 'undefined') return position
  const minX = getMinX()
  const minY = getMinY()
  const maxX = Math.max(minX, window.innerWidth - orbSize - 8)
  const maxY = Math.max(minY, window.innerHeight - orbSize - 8)
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  }
}

function getDefaultPosition(orbSize: number): Position {
  if (typeof window === 'undefined') return { x: 24, y: 24 }
  const minX = getMinX()
  const minY = getMinY()
  return {
    x: Math.max(minX, window.innerWidth - orbSize - 24),
    y: Math.max(minY, window.innerHeight - orbSize - 24),
  }
}

export default function MascotOrb() {
  const [open, setOpen] = useState(false)
  const [orbSize, setOrbSize] = useState(96)
  const [position, setPosition] = useState<Position>({ x: 24, y: 24 })
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [dragging, setDragging] = useState(false)
  const [speechIndex, setSpeechIndex] = useState(0)
  const speechBelow = position.y < 80
  const speechAnchoredLeft = position.x < viewportWidth / 2

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  })

  useEffect(() => {
    const nextSize = getOrbSize()
    setOrbSize(nextSize)
    setViewportWidth(window.innerWidth)
    const fallback = getDefaultPosition(nextSize)

    try {
      const raw = localStorage.getItem(POSITION_STORAGE_KEY)
      if (!raw) {
        setPosition(fallback)
        return
      }
      const parsed = JSON.parse(raw) as Position
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        setPosition(clampPosition(parsed, nextSize))
      } else {
        setPosition(fallback)
      }
    } catch {
      setPosition(fallback)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const nextSize = getOrbSize()
      setOrbSize(nextSize)
      setViewportWidth(window.innerWidth)
      setPosition((current) => clampPosition(current, nextSize))
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position))
    } catch {
      /* noop */
    }
  }, [position])

  useEffect(() => {
    if (open) return
    const interval = setInterval(() => {
      setSpeechIndex((current) => (current + 1) % SPEECH_LINES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [open])

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    }
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return

    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true

    setPosition(
      clampPosition(
        {
          x: dragRef.current.originX + dx,
          y: dragRef.current.originY + dy,
        },
        orbSize
      )
    )
  }

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return
    dragRef.current.active = false
    setDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const toggleOpen = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }
    setOpen((value) => !value)
  }

  return (
    <>
      <div
        className="fixed z-30 select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${orbSize}px`,
          height: `${orbSize}px`,
          transition: dragging || open ? 'none' : 'left 5.2s ease-in-out, top 5.2s ease-in-out',
        }}
      >
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`pointer-events-auto absolute z-20 w-[260px] max-w-[calc(100vw-32px)] rounded-xl border border-[#DDE5EE] bg-white/95 px-3 py-2 text-left shadow-[0_4px_16px_rgba(3,24,47,0.16)] backdrop-blur-sm transition hover:bg-white ${speechAnchoredLeft ? 'left-0' : 'right-0'} ${speechBelow ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'}`}
          >
            <p className="font-serif text-[11px] font-bold uppercase tracking-[0.1em] text-[#2764FF]">Leia</p>
            <p className="font-serif text-[12px] leading-5 text-[#30373E]">{SPEECH_LINES[speechIndex]}</p>
          </button>
        )}

        <button
          type="button"
          onClick={toggleOpen}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={open ? 'Close Leia' : 'Open Leia'}
          className="h-full w-full touch-none border-0 bg-transparent p-0"
          title="Drag me or click to chat"
        >
          <div className={`mascot-orb relative h-full w-full ${open ? 'is-open' : ''}`}>
            <div className="mascot-orb__halo" />
            <div className="mascot-orb__image-wrap">
              <Image
                src="/mascot-orb.png"
                alt="Leia"
                width={112}
                height={112}
                priority
                className="mascot-orb__image"
              />
              <div className="mascot-orb__smoke">
                <span className="mascot-orb__smoke-blob mascot-orb__smoke-blob--pink" />
                <span className="mascot-orb__smoke-blob mascot-orb__smoke-blob--blue" />
                <span className="mascot-orb__smoke-blob mascot-orb__smoke-blob--violet" />
                <span className="mascot-orb__smoke-blob mascot-orb__smoke-blob--cyan" />
              </div>
            </div>
          </div>
        </button>
      </div>

      <MascotChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
