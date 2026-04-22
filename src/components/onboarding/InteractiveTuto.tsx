'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  AlertTriangle,
  BarChart3 as BarChart,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe2,
  LayoutDashboard,
  MessageSquare,
  MousePointer2,
  Package,
  Puzzle,
  Settings,
  Ship,
  Sparkles,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePluginContext } from '@/contexts/PluginContext'
import { cn } from '@/lib/utils'

type InteractiveTutoProps = {
  onFinish: () => void
  onBack?: () => void
}

type TutoStep = 1 | 2 | 3
type WidgetId = 'sales' | 'stock' | 'alerts' | 'weather'

const steps: TutoStep[] = [1, 2, 3]
const narrationStep1 =
  "Le plugin 'Global Control Tower' est indispensable pour vos importations. Il croise vos donnees Mirakl avec le tracking international de @shippo et prepare vos paiements @stripe."
const step3UserMessage = 'Je serai absent du 1er au 15 août.'
const step3AssistantMessage =
  '⚠️ Risque de rupture détecté. En août, vos ventes sur Mirakl augmentent de 30%. Souhaitez-vous que je prépare un réapprovisionnement automatique pour couvrir votre absence ?'

const slideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 80 : -80,
  }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -80 : 80,
  }),
}

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        <Icon className="h-3.5 w-3.5" />
        Interactive Tuto
      </div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value))

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 36 36" className="h-24 w-24">
        <path
          d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        <path
          d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31"
          fill="none"
          stroke="#ef4444"
          strokeLinecap="round"
          strokeWidth="3"
          strokeDasharray={`${safe}, 100`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-500">
        {safe}%
      </span>
    </div>
  )
}

export default function InteractiveTuto({ onFinish, onBack }: InteractiveTutoProps) {
  const { activateProPlugin, deactivateProPlugin } = usePluginContext()

  const [currentStep, setCurrentStep] = useState<TutoStep>(1)
  const [direction, setDirection] = useState(1)

  const [pluginSimActive, setPluginSimActive] = useState(false)
  const [step1Glow, setStep1Glow] = useState(false)
  const [showStep1Success, setShowStep1Success] = useState(false)
  const [step1CursorStage, setStep1CursorStage] = useState<'start' | 'hover' | 'click'>('start')
  const [narrationIndex, setNarrationIndex] = useState(0)

  const [dashboardWidgets, setDashboardWidgets] = useState<WidgetId[]>(['sales', 'stock', 'alerts'])
  const [dashboardDragStock, setDashboardDragStock] = useState(false)
  const [step2CursorStage, setStep2CursorStage] = useState<
    | 'stock-start'
    | 'stock-drag-right'
    | 'stock-drop-right'
    | 'stock-drag-left'
    | 'stock-drop-left'
    | 'stock-drag-center'
    | 'stock-drop-center'
    | 'plus-hover'
    | 'plus-click'
    | 'done'
  >('stock-start')

  const [step3UserTyped, setStep3UserTyped] = useState(0)
  const [step3ShowLoader, setStep3ShowLoader] = useState(false)
  const [step3AssistantTyped, setStep3AssistantTyped] = useState(0)
  const [step3ShowActions, setStep3ShowActions] = useState(false)
  const [step3Decision, setStep3Decision] = useState<'approve' | 'ignore' | null>(null)

  const step1TimersRef = useRef<number[]>([])
  const step2TimersRef = useRef<number[]>([])
  const step3TimersRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const timerId of step1TimersRef.current) window.clearTimeout(timerId)
      for (const timerId of step2TimersRef.current) window.clearTimeout(timerId)
      for (const timerId of step3TimersRef.current) window.clearTimeout(timerId)
    }
  }, [])

  useEffect(() => {
    for (const timerId of step1TimersRef.current) window.clearTimeout(timerId)
    step1TimersRef.current = []

    if (currentStep !== 1) return

    setPluginSimActive(false)
    setStep1Glow(false)
    setShowStep1Success(false)
    setStep1CursorStage('start')
    setNarrationIndex(0)

    const typewriterInterval = window.setInterval(() => {
      setNarrationIndex((current) => {
        if (current >= narrationStep1.length) {
          window.clearInterval(typewriterInterval)
          return current
        }
        return current + 1
      })
    }, 20)

    const scheduleHover = (delay: number) =>
      window.setTimeout(() => {
        setStep1CursorStage('hover')
      }, delay)

    const scheduleToggle = (delay: number, active: boolean) =>
      window.setTimeout(() => {
        setStep1CursorStage('click')
        setPluginSimActive(active)
        setShowStep1Success(active)

        if (active) {
          setStep1Glow(false)
          const glowPulse = window.setTimeout(() => setStep1Glow(true), 30)
          step1TimersRef.current.push(glowPulse)
          activateProPlugin()
        } else {
          setStep1Glow(false)
          deactivateProPlugin()
        }
      }, delay)

    step1TimersRef.current.push(
      scheduleHover(450),
      scheduleToggle(900, true),
      scheduleHover(1320),
      scheduleToggle(1500, false),
      scheduleHover(1850),
      scheduleToggle(2030, true),
      scheduleHover(2380),
      scheduleToggle(2560, false),
      scheduleHover(2910),
      scheduleToggle(3090, true)
    )

    return () => {
      window.clearInterval(typewriterInterval)
      for (const timerId of step1TimersRef.current) window.clearTimeout(timerId)
      step1TimersRef.current = []
    }
  }, [activateProPlugin, currentStep, deactivateProPlugin])

  useEffect(() => {
    for (const timerId of step2TimersRef.current) window.clearTimeout(timerId)
    step2TimersRef.current = []

    if (currentStep !== 2) return

    setDashboardWidgets(['sales', 'stock', 'alerts'])
    setDashboardDragStock(false)
    setStep2CursorStage('stock-start')

    const dragRight = window.setTimeout(() => {
      setStep2CursorStage('stock-drag-right')
      setDashboardDragStock(true)
    }, 420)

    const dropRight = window.setTimeout(() => {
      setStep2CursorStage('stock-drop-right')
      setDashboardDragStock(false)
      setDashboardWidgets(['sales', 'alerts', 'stock'])
    }, 1080)

    const dragLeft = window.setTimeout(() => {
      setStep2CursorStage('stock-drag-left')
      setDashboardDragStock(true)
    }, 1480)

    const dropLeft = window.setTimeout(() => {
      setStep2CursorStage('stock-drop-left')
      setDashboardDragStock(false)
      setDashboardWidgets(['stock', 'sales', 'alerts'])
    }, 2140)

    const dragCenter = window.setTimeout(() => {
      setStep2CursorStage('stock-drag-center')
      setDashboardDragStock(true)
    }, 2520)

    const dropCenter = window.setTimeout(() => {
      setStep2CursorStage('stock-drop-center')
      setDashboardDragStock(false)
      setDashboardWidgets(['sales', 'stock', 'alerts'])
    }, 3140)

    const plusHover = window.setTimeout(() => setStep2CursorStage('plus-hover'), 3520)
    const plusClick = window.setTimeout(() => {
      setStep2CursorStage('plus-click')
      setDashboardWidgets((current) => (current.includes('weather') ? current : [...current, 'weather']))
    }, 3920)

    const done = window.setTimeout(() => setStep2CursorStage('done'), 4500)

    step2TimersRef.current.push(
      dragRight,
      dropRight,
      dragLeft,
      dropLeft,
      dragCenter,
      dropCenter,
      plusHover,
      plusClick,
      done
    )

    return () => {
      for (const timerId of step2TimersRef.current) window.clearTimeout(timerId)
      step2TimersRef.current = []
    }
  }, [currentStep])

  useEffect(() => {
    for (const timerId of step3TimersRef.current) window.clearTimeout(timerId)
    step3TimersRef.current = []

    if (currentStep !== 3) return

    setStep3UserTyped(0)
    setStep3ShowLoader(false)
    setStep3AssistantTyped(0)
    setStep3ShowActions(false)
    setStep3Decision(null)

    const userTypeInterval = window.setInterval(() => {
      setStep3UserTyped((current) => {
        if (current >= step3UserMessage.length) {
          window.clearInterval(userTypeInterval)
          setStep3ShowLoader(true)

          const stopLoader = window.setTimeout(() => {
            setStep3ShowLoader(false)
            const assistantTypeInterval = window.setInterval(() => {
              setStep3AssistantTyped((value) => {
                if (value >= step3AssistantMessage.length) {
                  window.clearInterval(assistantTypeInterval)
                  setStep3ShowActions(true)
                  return value
                }
                return value + 1
              })
            }, 52)
            step3TimersRef.current.push(assistantTypeInterval)
          }, 1800)

          step3TimersRef.current.push(stopLoader)
          return current
        }
        return current + 1
      })
    }, 70)

    step3TimersRef.current.push(userTypeInterval)

    return () => {
      window.clearInterval(userTypeInterval)
      for (const timerId of step3TimersRef.current) window.clearTimeout(timerId)
      step3TimersRef.current = []
    }
  }, [currentStep])

  const goToStep = (step: TutoStep) => {
    if (step === currentStep) return
    setDirection(step > currentStep ? 1 : -1)
    setCurrentStep(step)
  }

  const goToPrev = () => {
    if (currentStep === 1) return
    goToStep((currentStep - 1) as TutoStep)
  }

  const goToNext = () => {
    if (currentStep === 3) return
    goToStep((currentStep + 1) as TutoStep)
  }

  const handleStep1ToggleManual = () => {
    const next = !pluginSimActive
    setPluginSimActive(next)
    setShowStep1Success(next)
    setStep1Glow(next)
    if (next) activateProPlugin()
    else deactivateProPlugin()
  }

  const step2CursorPosition = useMemo(() => {
    if (step2CursorStage === 'stock-start') return { x: 230, y: 190 }
    if (step2CursorStage === 'stock-drag-right') return { x: 388, y: 220 }
    if (step2CursorStage === 'stock-drop-right') return { x: 470, y: 248 }
    if (step2CursorStage === 'stock-drag-left') return { x: 300, y: 238 }
    if (step2CursorStage === 'stock-drop-left') return { x: 178, y: 206 }
    if (step2CursorStage === 'stock-drag-center') return { x: 305, y: 218 }
    if (step2CursorStage === 'stock-drop-center') return { x: 348, y: 205 }
    if (step2CursorStage === 'plus-hover' || step2CursorStage === 'plus-click') return { x: 610, y: 22 }
    return { x: 610, y: 22 }
  }, [step2CursorStage])

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <div>
          <StepHeader
            icon={Puzzle}
            title="Un écosystème à la carte"
            description="Activez les modules dont vous avez besoin."
          />

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {step1Glow && (
              <motion.div
                initial={{ opacity: 0.8, scale: 0.4 }}
                animate={{ opacity: 0, scale: 2.4 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="pointer-events-none absolute right-5 top-5 h-28 w-28 rounded-full bg-blue-500/35 blur-2xl"
              />
            )}

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-600">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">Global Control Tower</p>
                  <p className="mt-1 max-w-xl text-sm text-slate-500">
                    Plateforme unifiée pour tracker vos flux mondiaux, automatiser le routage et sécuriser vos encaissements.
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Certifié Mirakl
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Logistique', 'IA', 'Stripe'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-800">5.0</span>
                <span className="text-sm text-slate-500">12k installations</span>
              </div>

              <button
                type="button"
                onClick={handleStep1ToggleManual}
                className={cn(
                  'relative inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
                  pluginSimActive
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                    : 'border-slate-300 bg-slate-100 text-slate-600'
                )}
              >
                <span
                  className={cn(
                    'relative h-7 w-12 rounded-full border transition-colors',
                    pluginSimActive ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-200'
                  )}
                >
                  <motion.span
                    initial={false}
                    animate={{ x: pluginSimActive ? 23 : 2 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                    className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
                  />
                </span>
                {pluginSimActive ? 'Actif' : 'Activer'}
              </button>
            </div>

            <AnimatePresence>
              {showStep1Success && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Plugin activé avec succès.
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className="pointer-events-none absolute text-slate-900"
              animate={{
                x: step1CursorStage === 'start' ? 450 : step1CursorStage === 'hover' ? 650 : 652,
                y: step1CursorStage === 'start' ? 170 : step1CursorStage === 'hover' ? 170 : 172,
                scale: step1CursorStage === 'click' ? 0.92 : 1,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <MousePointer2 className="h-6 w-6 drop-shadow" />
            </motion.div>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:w-[72%]">
              <p className="text-sm leading-7 text-slate-700">
                {narrationStep1.slice(0, narrationIndex)}
                {narrationIndex < narrationStep1.length && <span className="animate-pulse">|</span>}
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (currentStep === 2) {
      return (
        <div>
          <StepHeader
            icon={LayoutDashboard}
            title="Votre bureau, vos règles"
            description="Configurez votre dashboard comme vous le souhaitez."
          />

          <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard Personnel
              </div>
              <button
                type="button"
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-sm font-semibold transition-colors',
                  dashboardWidgets.includes('weather')
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-300 bg-slate-100 text-slate-600'
                )}
              >
                +
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {dashboardWidgets.map((widget) => {
                if (widget === 'sales') {
                  return (
                    <motion.article
                      key={widget}
                      layout
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ventes</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">45 200 €</p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-green-500">
                          +12.5%
                        </span>
                      </div>
                      <div className="mt-4 flex h-20 items-end gap-1">
                        {[26, 30, 38, 42, 48, 56, 52, 64].map((height, index) => (
                          <div key={index} className="w-4 rounded-sm bg-blue-500/85" style={{ height }} />
                        ))}
                      </div>
                    </motion.article>
                  )
                }

                if (widget === 'stock') {
                  return (
                    <motion.article
                      key={widget}
                      layout
                      className={cn(
                        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
                        dashboardDragStock && 'cursor-grab border-dashed border-blue-400 shadow-xl'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Stock</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">Niveau Global</p>
                          <p className="text-sm text-red-500">3 produits en rupture</p>
                        </div>
                        <ProgressRing value={80} />
                      </div>
                    </motion.article>
                  )
                }

                if (widget === 'alerts') {
                  return (
                    <motion.article
                      key={widget}
                      layout
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Alertes</p>
                      <ul className="mt-3 space-y-2 text-sm">
                        <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-700">
                          <Ship className="h-4 w-4 text-red-500" />
                          Bateau retardé - Rotterdam
                        </li>
                        <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-700">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          Avis client négatif à traiter
                        </li>
                        <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-700">
                          <CreditCard className="h-4 w-4 text-green-500" />
                          Paiement Stripe reçu
                        </li>
                      </ul>
                    </motion.article>
                  )
                }

                return (
                  <motion.article
                    key={widget}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-cyan-700">
                      <CloudIcon />
                      <p className="text-sm font-semibold">Météo Supply Chain</p>
                    </div>
                    <p className="mt-2 text-sm text-cyan-700">Port de Shanghai: vent fort, risque de retard +8h</p>
                  </motion.article>
                )
              })}
            </div>

            <motion.div
              className="pointer-events-none absolute text-slate-900"
              animate={{
                x: step2CursorPosition.x,
                y: step2CursorPosition.y,
                scale:
                  step2CursorStage === 'plus-click' ||
                  step2CursorStage === 'stock-drop-right' ||
                  step2CursorStage === 'stock-drop-left' ||
                  step2CursorStage === 'stock-drop-center'
                    ? 0.9
                    : 1,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <MousePointer2 className="h-6 w-6 drop-shadow" />
            </motion.div>
          </div>
        </div>
      )
    }

    return (
      <div>
        <StepHeader
          icon={Sparkles}
          title="L'IA qui connaît votre business"
          description="Anticipez et protégez votre croissance."
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-slate-900">Assistant Mira</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              Smart Assistant
            </span>
          </div>

          <div className="min-h-[280px] space-y-4 py-4">
            <div className="ml-auto max-w-[88%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
              {step3UserMessage.slice(0, step3UserTyped)}
              {step3UserTyped < step3UserMessage.length && <span className="animate-pulse">|</span>}
            </div>

            {step3ShowLoader && (
              <div className="max-w-[84%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Mira réfléchit...
              </div>
            )}

            {step3AssistantTyped > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[90%] rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-800 shadow-[0_0_0_0_rgba(59,130,246,0.2)]"
              >
                <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700">
                  <Sparkles className="h-3 w-3" />
                  Assistant Mira
                </div>
                <p>
                  {step3AssistantMessage.slice(0, step3AssistantTyped)}
                  {step3AssistantTyped < step3AssistantMessage.length && <span className="animate-pulse">|</span>}
                </p>

                {step3ShowActions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setStep3Decision('approve')}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        step3Decision === 'approve'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      ✨ Valider la stratégie
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep3Decision('ignore')}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        step3Decision === 'ignore'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      )}
                    >
                      Ignorer
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {step3Decision === 'approve' && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Stratégie validée, les actions peuvent être planifiées.
            </div>
          )}
          {step3Decision === 'ignore' && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Suggestion ignorée pour le moment.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/50 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(246,250,255,0.94)_100%)] p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tutoriel interactif
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Démonstration des 3 piliers Mirakl
          </h2>
        </div>

        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Retour
          </Button>
        )}
      </div>

      <div className="relative min-h-[470px] overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-4 sm:p-5">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <Button variant="outline" onClick={goToPrev} disabled={currentStep === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Précédent
        </Button>

        <div className="flex items-center gap-2">
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => goToStep(step)}
              aria-label={`Etape ${step}`}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all',
                currentStep === step ? 'w-6 bg-blue-600' : 'bg-slate-300 hover:bg-slate-400'
              )}
            />
          ))}
        </div>

        {currentStep < 3 ? (
          <Button onClick={goToNext}>
            Suivant
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onFinish} className="bg-slate-900 text-white hover:bg-slate-800">
            🚀 Terminer et accéder au Dashboard
          </Button>
        )}
      </div>
    </div>
  )
}

function CloudIcon() {
  return (
    <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-200/70 text-cyan-700">
      <Package className="h-3.5 w-3.5" />
    </div>
  )
}
