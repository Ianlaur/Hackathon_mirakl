'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import MascotChatDrawer from './MascotChatDrawer'
import OrbModePanel from './orb/OrbModePanel'

export default function MascotOrb() {
  const [open, setOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setModeOpen(true)
          }}
          aria-label="Contrôle MIRA — qui fait quoi"
          title="Contrôle MIRA"
          className="mira-button grid h-10 w-10 place-items-center rounded-full shadow-md"
        >
          <Settings2 className="h-4 w-4 text-[color:var(--mira-ink)]" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer MIRA' : 'Parler à MIRA'}
          className="h-24 w-24 select-none border-0 bg-transparent p-0 lg:h-28 lg:w-28"
        >
          <div className={`mascot-orb relative h-full w-full cursor-pointer ${open ? 'is-open' : ''}`}>
            <div className="mascot-orb__halo" />
            <div className="mascot-orb__image-wrap">
              <Image
                src="/mascot-orb.png"
                alt="MIRA"
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
      <OrbModePanel open={modeOpen} onClose={() => setModeOpen(false)} />
    </>
  )
}
