'use client'

import Link from 'next/link'
import {
  Blocks,
  Bot,
  Brain,
  CheckCircle2,
  Globe,
  Headset,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from 'lucide-react'
import { usePluginContext } from '@/contexts/PluginContext'

const featurePills = [
  { label: 'Live Shipment Map', icon: Globe },
  { label: 'Stripe Payments', icon: Wallet },
  { label: 'AI Rerouting', icon: Zap },
  { label: 'Enterprise SLA', icon: ShieldCheck },
]

const smallPlugins = [
  {
    name: 'Auto-Sourcing',
    category: 'Procurement',
    description:
      'AI-powered supplier discovery. Automatically finds the best-priced manufacturers matching your product catalog.',
    installs: '2.3k installs',
    rating: '4.8',
    icon: Blocks,
  },
  {
    name: 'Predictive Support',
    category: 'Customer Experience',
    description:
      'Anticipates buyer issues before they occur. Auto-generates support responses and proactive delivery alerts.',
    installs: '1.8k installs',
    rating: '4.6',
    icon: Headset,
  },
  {
    name: 'Demand Forecasting',
    category: 'Analytics',
    description:
      'Predicts stock demand up to 90 days out using marketplace trends, seasonality, and historical sell-through.',
    installs: '4.1k installs',
    rating: '4.9',
    icon: Brain,
  },
]

export default function AppStorePage() {
  const { isProPluginActive, toggleProPlugin } = usePluginContext()

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Agentic App Store</h1>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
            4 PLUGINS
          </span>
        </div>
        <p className="mt-3 text-xl text-slate-600">Extend your Mirakl seller experience with AI-powered plugins.</p>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(130deg,#031b43_0%,#032a65_55%,#05367f_100%)] p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="rounded-3xl bg-blue-500/20 p-6 ring-1 ring-blue-300/30">
            <Globe className="h-14 w-14 text-blue-200" />
          </div>

          <div className="flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-semibold tracking-tight">Global Control Tower & Stripe Routing</h2>
              <span className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold">FEATURED</span>
            </div>

            <p className="text-2xl font-semibold text-blue-200">Logistics · Payments</p>
            <p className="max-w-4xl text-2xl leading-relaxed text-blue-100/85">
              The most powerful plugin in the ecosystem. Monitor global shipments in real time, receive AI-driven rerouting recommendations when disruptions occur, and process payments instantly via Stripe.
            </p>

            <div className="flex flex-wrap gap-3">
              {featurePills.map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-500/10 px-4 py-2 text-base text-blue-100"
                >
                  <pill.icon className="h-4 w-4" />
                  {pill.label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3 text-amber-300">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-300" />
                  <Star className="h-4 w-4 fill-amber-300" />
                  <Star className="h-4 w-4 fill-amber-300" />
                  <Star className="h-4 w-4 fill-amber-300" />
                  <Star className="h-4 w-4 fill-amber-300" />
                </span>
                <span className="text-lg text-blue-100">5.0</span>
                <span className="text-lg text-blue-100/80">12.4k installs</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={toggleProPlugin}
                  className={`inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-xl font-semibold text-white shadow-lg transition ${
                    isProPluginActive
                      ? 'bg-rose-500 shadow-rose-700/30 hover:bg-rose-400'
                      : 'bg-blue-500 shadow-blue-700/40 hover:bg-blue-400'
                  }`}
                >
                  {isProPluginActive ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                  {isProPluginActive ? 'Désactiver le plugin' : 'Activer le plugin'}
                </button>

                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-2xl border border-white/30 bg-white/10 px-6 py-4 text-lg font-semibold text-white transition hover:bg-white/15"
                >
                  Ouvrir Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-blue-400/20 blur-2xl" />
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold uppercase tracking-[0.18em] text-slate-700">More Plugins</h3>

        <div className="grid gap-4 lg:grid-cols-3">
          {smallPlugins.map((plugin) => (
            <article key={plugin.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-start gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-indigo-600">
                  <plugin.icon className="h-8 w-8" />
                </div>

                <div>
                  <h4 className="text-4xl font-semibold tracking-tight text-slate-900">{plugin.name}</h4>
                  <p className="mt-1 text-2xl font-semibold text-indigo-700">{plugin.category}</p>
                </div>
              </div>

              <p className="min-h-[120px] text-2xl leading-relaxed text-slate-700">{plugin.description}</p>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1 text-amber-500">
                    <Star className="h-4 w-4 fill-amber-500" />
                    <Star className="h-4 w-4 fill-amber-500" />
                    <Star className="h-4 w-4 fill-amber-500" />
                    <Star className="h-4 w-4 fill-amber-500" />
                    <Star className="h-4 w-4 fill-amber-500" />
                    <span className="ml-1 text-lg font-medium text-slate-700">{plugin.rating}</span>
                  </p>
                  <p className="mt-1 text-xl text-slate-500">{plugin.installs}</p>
                </div>

                <button
                  disabled
                  className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-xl font-semibold text-slate-400"
                  title="Only Global Control Tower plugin is activable for now"
                >
                  Locked
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="inline-flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" /> Product rule: only the featured “Global Control Tower & Stripe Routing” plugin can be activated.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <p className="inline-flex items-center gap-2">
          <Bot className="h-4 w-4" /> This is a mock marketplace UI with local states only (no external API).
        </p>
      </section>
    </div>
  )
}
