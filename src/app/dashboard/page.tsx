import Link from 'next/link'

const modules = [
  {
    name: 'Paramètres',
    href: '/settings',
    description: 'Profil, identité visuelle et options du compte.',
    tone: 'from-slate-900 to-slate-700',
  },
  {
    name: 'Stock',
    href: '/stock',
    description: 'Catalogue produits, catégories et niveaux de stock.',
    tone: 'from-blue-600 to-cyan-500',
  },
  {
    name: 'Entrepôt',
    href: '/wms',
    description: 'Zones, bacs, picking lists et opérations terrain.',
    tone: 'from-emerald-600 to-teal-500',
  },
  {
    name: 'Transport',
    href: '/parcels',
    description: 'Suivi des colis et vision opérationnelle logistique.',
    tone: 'from-amber-500 to-orange-500',
  },
  {
    name: 'Calendrier',
    href: '/calendar',
    description: 'Planning interactif pour tâches, livraisons et relances.',
    tone: 'from-violet-600 to-fuchsia-500',
  },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="dashboard-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
              Main Dashboard
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Hackathon Mirakl workspace
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                This copy now opens on a real dashboard with a working left sidebar and only the sections that exist in this hackathon build.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/stock"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Open Stock
              </Link>
              <Link
                href="/settings"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Settings
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Included navigation</p>
            <div className="mt-5 grid gap-3">
              {modules.map((module, index) => (
                <div key={module.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-400">0{index + 1}</p>
                  <p className="mt-1 text-lg font-medium">{module.name}</p>
                  <p className="mt-1 text-sm text-slate-300">{module.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        {modules.map((module) => (
          <Link
            key={module.name}
            href={module.href}
            className="dashboard-card group overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`h-2 rounded-full bg-gradient-to-r ${module.tone}`} />
            <h2 className="mt-5 text-xl font-semibold text-slate-950">{module.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
            <p className="mt-5 text-sm font-medium text-blue-700 group-hover:text-blue-800">Open module</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
