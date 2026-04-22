'use client'

import Image from 'next/image'

export default function MascotOrb() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-6 right-6 z-50 h-24 w-24 select-none lg:h-28 lg:w-28"
    >
      <div className="mascot-orb pointer-events-auto relative h-full w-full cursor-pointer">
        <div className="mascot-orb__halo" />
        <div className="mascot-orb__image-wrap">
          <Image
            src="/mascot-orb.png"
            alt="Mascotte Mirakl"
            width={112}
            height={112}
            priority
            className="mascot-orb__image"
          />
        </div>
      </div>
    </div>
  )
}
