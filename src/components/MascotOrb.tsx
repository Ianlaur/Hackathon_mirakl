'use client'

import Image from 'next/image'
import { useState } from 'react'
import MascotChatDrawer from './MascotChatDrawer'

export default function MascotOrb() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer MIRA' : 'Parler à MIRA'}
        className="fixed bottom-6 right-6 z-30 h-24 w-24 select-none border-0 bg-transparent p-0 lg:h-28 lg:w-28"
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
            </div>
          </div>
        </div>
      </button>

      <MascotChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
