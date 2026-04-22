import { NextRequest, NextResponse } from 'next/server'
import { normalizeActionId, runQuickAction } from '@/lib/dust'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const actionId = normalizeActionId(payload?.actionId)

    if (!actionId) {
      return NextResponse.json(
        { error: 'Action invalide. Merci de reessayer.' },
        { status: 400 }
      )
    }

    const result = await runQuickAction(actionId)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Action route error:', error)
    return NextResponse.json(
      { error: 'Impossible de recuperer vos donnees, reessayez.' },
      { status: 500 }
    )
  }
}
