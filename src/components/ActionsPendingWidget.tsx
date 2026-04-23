import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export default async function ActionsPendingWidget() {
  const userId = await getCurrentUserId()

  const pending = await prisma.agentRecommendation.findMany({
    where: { user_id: userId, status: 'pending_approval' },
    orderBy: { created_at: 'desc' },
    take: 3,
  })

  const totalCount = await prisma.agentRecommendation.count({
    where: { user_id: userId, status: 'pending_approval' },
  })

  return (
    <div className="dashboard-card overflow-hidden p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#6B7480]">Pending actions</p>
          <p className="mt-1 text-4xl font-semibold text-[#03182F]">{totalCount}</p>
        </div>
        <Link
          href="/actions"
          className="rounded-xl bg-[#2764FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {"Open inbox →"}
        </Link>
      </div>

      {pending.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-[#30373E]"
            >
              {r.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[#6B7480]">
          {"All caught up. The agent will flag any risk it detects."}
        </p>
      )}
    </div>
  )
}
