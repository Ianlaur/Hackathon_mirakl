'use client'

import type { ComponentType } from 'react'
import {
  Boxes,
  CheckCircle2,
  GitBranch,
  Inbox,
  Layers,
  PlugZap,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { useActivePlugins } from '@/hooks/useActivePlugins'

const PLUGIN_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  plugin_actions: Inbox,
  plugin_operations: GitBranch,
  plugin_inventaire: Boxes,
}

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

function pluralize(value: number, singular: string, plural: string) {
  return value > 1 ? `${value} ${plural}` : `${value} ${singular}`
}

export default function AppStorePage() {
  const { activePlugins, togglePlugin, isActive, setPlugins } = useActivePlugins()
  const sortedPlugins = NAVIGATION_CONFIG.plugins.slice().sort((a, b) => a.position - b.position)
  const allPluginIds = sortedPlugins.map((plugin) => plugin.id)
  const isBasicMode = activePlugins.length === 0
  const isProMode = allPluginIds.every((pluginId) => activePlugins.includes(pluginId))
  const totalTabsUnlocked = sortedPlugins.reduce(
    (count, plugin) => count + listInjectedTabs(plugin.id).length,
    0
  )
  const activeTabs = sortedPlugins
    .filter((plugin) => activePlugins.includes(plugin.id))
    .reduce((count, plugin) => count + listInjectedTabs(plugin.id).length, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-50 via-cyan-50 to-white px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                Plugin Hub
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                App Store Mirakl
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
                Activez uniquement les modules utiles a Jean-Charles. Chaque plugin ajoute des
                onglets dans la sidebar, sans complexifier le dashboard BASIC.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPlugins(allPluginIds)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Zap className="h-4 w-4" />
                Tout activer
              </button>
              <button
                type="button"
                onClick={() => setPlugins([])}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <ToggleLeft className="h-4 w-4" />
                Tout desactiver
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-blue-100 px-6 py-4 sm:grid-cols-3 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mode</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {isProMode ? 'PRO' : isBasicMode ? 'BASIC' : 'Personnalise'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Plugins actifs</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {activePlugins.length} / {sortedPlugins.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Onglets deblocables</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {activeTabs} / {totalTabsUnlocked}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Mode dashboard
            </p>
            <p className="mt-1 text-sm text-slate-600">
              BASIC pour rester minimal, PRO pour debloquer tous les modules.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setPlugins([])}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isBasicMode
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              BASIC
            </button>
            <button
              type="button"
              onClick={() => setPlugins(allPluginIds)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isProMode
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              PRO
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedPlugins.map((plugin) => {
          const active = isActive(plugin.id)
          const injectedTabs = listInjectedTabs(plugin.id)
          const PluginIcon = PLUGIN_ICONS[plugin.id] ?? PlugZap

          return (
            <article
              key={plugin.id}
              className={`rounded-3xl border p-5 transition-all duration-200 ${
                active
                  ? 'border-blue-200 bg-blue-50/50 shadow-sm'
                  : 'border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-2xl p-2.5 ${
                      active
                        ? 'border border-blue-200 bg-white text-blue-700'
                        : 'border border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <PluginIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{plugin.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{plugin.description}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    active
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {active ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  Ajoute dans le menu
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {injectedTabs.map((tab) => (
                    <span
                      key={`${plugin.id}-${tab}`}
                      className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {pluralize(injectedTabs.length, 'onglet ajoute', 'onglets ajoutes')}
                </p>
                <button
                  type="button"
                  onClick={() => togglePlugin(plugin.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {active ? 'Desactiver' : 'Activer'}
                </button>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
