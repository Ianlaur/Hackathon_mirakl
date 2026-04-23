'use client'

import { Layers, PlugZap, ToggleLeft, ToggleRight } from 'lucide-react'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { useActivePlugins } from '@/hooks/useActivePlugins'

function listInjectedTabs(pluginId: string) {
  const plugin = NAVIGATION_CONFIG.plugins.find((entry) => entry.id === pluginId)
  if (!plugin) return []

  return plugin.items.flatMap((item) => {
    if (item.subitems?.length) {
      return [item.label, ...item.subitems.map((subitem) => subitem.label)]
    }
    return [item.label]
  })
}

export default function AppStorePage() {
  const { activePlugins, togglePlugin, isActive } = useActivePlugins()

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">App Store</h1>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {activePlugins.length} actif(s)
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Activez les plugins pour débloquer des onglets supplémentaires dans la sidebar.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {NAVIGATION_CONFIG.plugins
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((plugin) => {
            const active = isActive(plugin.id)
            const injectedTabs = listInjectedTabs(plugin.id)

            return (
              <article key={plugin.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-blue-700">
                      <PlugZap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{plugin.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{plugin.description}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      active
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {active ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                    <Layers className="h-3.5 w-3.5" />
                    Ajoute dans le menu
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{injectedTabs.join(' · ')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => togglePlugin(plugin.id)}
                  className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {active ? 'Désactiver' : 'Activer'}
                </button>
              </article>
            )
          })}
      </section>
    </div>
  )
}
