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
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Actions en attente</p>
          <p className="mt-1 text-4xl font-semibold text-slate-950">{totalCount}</p>
        </div>
        <Link
          href="/actions"
          className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {"Ouvrir l'inbox →"}
        </Link>
      </div>

      {pending.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              {r.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {"Tout est à jour. L'agent te préviendra s'il détecte un risque."}
        </p>
      )}
    </div>
  )
}
