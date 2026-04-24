import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/session'
import { executeTool } from '@/lib/mascot-tools'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json().catch(() => ({}))
    const origin = new URL(request.url).origin
    const result = await executeTool('declare_supplier_loss', body, { userId, origin })
    return NextResponse.json(result)
  } catch (error) {
    console.error('supplier loss declaration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
