import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { NAVIGATION_CONFIG } from '@/lib/navigation'

describe('Leia governance navigation', () => {
  it('exposes governance as a sidebar route', () => {
    expect(NAVIGATION_CONFIG.basicItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'governance',
          label: 'Governance',
          href: '/governance',
        }),
      ])
    )
  })

  it('replaces the old losses page with Losses Radar', () => {
    expect(NAVIGATION_CONFIG.basicItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'lost',
          label: 'Losses Radar',
          href: '/radar',
        }),
      ])
    )
  })

  it('keeps governance controls out of the floating dashboard orb', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/MascotOrb.tsx'), 'utf8')

    expect(source).not.toContain('/api/autonomy')
    expect(source).not.toContain('Leia governance')
  })
})
