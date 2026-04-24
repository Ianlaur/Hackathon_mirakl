import { NextRequest, NextResponse } from 'next/server'
import { GET as copilotGET, POST as copilotPOST } from '@/app/api/copilot/chat/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  return copilotGET(request)
}

export async function POST(request: NextRequest) {
  const upstream = await copilotPOST(request)
  const body = await upstream.json()

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status })
  }

  return NextResponse.json({
    response: body.message?.content ?? '',
    tool_calls: body.tool_calls ?? [],
    decisions_made: body.recommendations ?? [],
    sessionId: body.sessionId,
    language: body.language,
    model: body.model,
  })
}
