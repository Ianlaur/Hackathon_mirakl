'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import MascotChatDrawer from './MascotChatDrawer'

const SPEECH_LINES = [
  'Hi, I am Leia. Ask me anything about your operations.',
  'Need a quick action plan? I can prepare one.',
  'I can help with stock, transport and planning decisions.',
]

export default function MascotOrb() {
  const [open, setOpen] = useState(false)
  const [speechIndex, setSpeechIndex] = useState(0)
  const [speechDismissed, setSpeechDismissed] = useState(false)

  useEffect(() => {
    if (open) return
    const interval = setInterval(() => {
      setSpeechIndex((current) => (current + 1) % SPEECH_LINES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [open])

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 h-24 w-24 select-none lg:h-28 lg:w-28">
        {!open && !speechDismissed && (
          <div className="pointer-events-auto absolute bottom-[calc(100%+8px)] right-0 z-20 w-[260px] max-w-[calc(100vw-32px)] rounded-xl border border-[#DDE5EE] bg-white/95 px-3 py-2 text-left shadow-[0_4px_16px_rgba(3,24,47,0.16)] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSpeechDismissed(true)}
              className="absolute right-1 top-1 rounded p-1 text-[#6B7480] hover:bg-[#F2F8FF] hover:text-[#03182F]"
              aria-label="Close Leia suggestion"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full pr-5 text-left transition hover:bg-white"
            >
              <p className="font-serif text-[11px] font-bold uppercase tracking-[0.1em] text-[#2764FF]">Leia</p>
              <p className="font-serif text-[12px] leading-5 text-[#30373E]">{SPEECH_LINES[speechIndex]}</p>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close Leia' : 'Open Leia'}
          className="h-full w-full border-0 bg-transparent p-0"
          title="Open Leia chat"
        >
          <div className={`mascot-orb relative h-full w-full ${open ? 'is-open' : ''}`}>
            <div className="mascot-orb__halo" />
            <div className="mascot-orb__image-wrap">
              <Image
                src="/mascot-orb.png"
                alt="Mirakl mascot"
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
