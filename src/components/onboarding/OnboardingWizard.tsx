'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Factory,
  Globe2,
  Home,
  Loader2,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { usePluginContext } from '@/contexts/PluginContext'
import { cn } from '@/lib/utils'
import InteractiveTuto from '@/components/onboarding/InteractiveTuto'

type WizardStep = 1 | 2 | 3 | 4
type ProductionAnswer = 'LOCAL_MAKER' | 'INTERNATIONAL_SUPPLIERS' | null
type StorageAnswer = 'WORKSHOP' | 'MULTI_WAREHOUSE' | null
type AutonomyAnswer = 'SUGGESTION_ONLY' | 'FULL_AUTOMATION' | null

type ChoiceCardProps = {
  title: string
  description: string
  selected: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
}

const loadingMessages = [
  'Analyse de votre supply chain...',
  "Configuration de l'assistant Mira...",
  'Préparation du Dashboard...',
]

const progressByStep: Record<WizardStep, number> = {
  1: 25,
  2: 50,
  3: 75,
  4: 100,
}

function ChoiceCard({ title, description, selected, onClick, icon: Icon }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border p-5 text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        selected
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'rounded-xl p-2.5',
            selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold">{title}</p>
          <p className={cn('text-sm', selected ? 'text-slate-100/90' : 'text-slate-500')}>
            {description}
          </p>
        </div>
      </div>
    </button>
  )
}

export default function OnboardingWizard() {
  const router = useRouter()
  const { activateProPlugin, deactivateProPlugin, setUserProfile } = usePluginContext()

  const [step, setStep] = useState<WizardStep>(1)
  const [production, setProduction] = useState<ProductionAnswer>(null)
  const [storage, setStorage] = useState<StorageAnswer>(null)
  const [autonomy, setAutonomy] = useState<AutonomyAnswer>(null)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [showInteractiveTour, setShowInteractiveTour] = useState(false)

  const computedProfile = useMemo<'LOCAL' | 'INTERNATIONAL'>(() => {
    if (production === 'INTERNATIONAL_SUPPLIERS' && storage === 'MULTI_WAREHOUSE') {
      return 'INTERNATIONAL'
    }
    return 'LOCAL'
  }, [production, storage])

  useEffect(() => {
    if (step !== 3) return

    setLoadingMessageIndex(0)

    const messageTicker = window.setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, 820)

    const timer = window.setTimeout(() => {
      if (computedProfile === 'INTERNATIONAL') {
        setUserProfile('INTERNATIONAL')
        activateProPlugin()
      } else {
        setUserProfile('LOCAL')
        deactivateProPlugin()
      }
      setStep(4)
    }, 2500)

    return () => {
      window.clearInterval(messageTicker)
      window.clearTimeout(timer)
    }
  }, [activateProPlugin, computedProfile, deactivateProPlugin, setUserProfile, step])

  if (showInteractiveTour) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-6xl items-center justify-center py-8">
        <InteractiveTuto
          onBack={() => setShowInteractiveTour(false)}
          onFinish={() => router.push('/dashboard')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-4xl items-center justify-center py-8">
      <Card className="w-full max-w-3xl border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Configuration initiale
              </p>
              <CardTitle className="mt-2 text-3xl text-slate-950">Tour de Contrôle Mirakl</CardTitle>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Étape {step}/4
            </span>
          </div>
          <Progress value={progressByStep[step]} />
        </CardHeader>

        <CardContent>
          <div
            key={step}
            className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <CardTitle className="text-2xl">Production & Sourcing</CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    Nous adaptons votre espace selon votre réalité opérationnelle.
                  </CardDescription>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Comment produisez-vous ?</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ChoiceCard
                      title="Je produis moi-même"
                      description="Atelier local, flux courts, pilotage simple."
                      selected={production === 'LOCAL_MAKER'}
                      onClick={() => setProduction('LOCAL_MAKER')}
                      icon={Factory}
                    />
                    <ChoiceCard
                      title="Plusieurs fournisseurs internationaux"
                      description="Sourcing multi-pays, coordination import."
                      selected={production === 'INTERNATIONAL_SUPPLIERS'}
                      onClick={() => setProduction('INTERNATIONAL_SUPPLIERS')}
                      icon={Globe2}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Où stockez-vous ?</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ChoiceCard
                      title="Dans mon atelier"
                      description="Stock centralisé, faible complexité."
                      selected={storage === 'WORKSHOP'}
                      onClick={() => setStorage('WORKSHOP')}
                      icon={Home}
                    />
                    <ChoiceCard
                      title="Dans plusieurs entrepôts"
                      description="Réseau multi-sites et distribution étendue."
                      selected={storage === 'MULTI_WAREHOUSE'}
                      onClick={() => setStorage('MULTI_WAREHOUSE')}
                      icon={Warehouse}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <CardTitle className="text-2xl">Préférences IA</CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    Choisissez votre niveau d’autonomie pour l’assistance opérationnelle.
                  </CardDescription>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ChoiceCard
                    title="Suggestion uniquement"
                    description="Vous validez toutes les décisions importantes."
                    selected={autonomy === 'SUGGESTION_ONLY'}
                    onClick={() => setAutonomy('SUGGESTION_ONLY')}
                    icon={ShieldCheck}
                  />
                  <ChoiceCard
                    title="Automatisation complète"
                    description="L’outil exécute davantage d’actions automatiquement."
                    selected={autonomy === 'FULL_AUTOMATION'}
                    onClick={() => setAutonomy('FULL_AUTOMATION')}
                    icon={Bot}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-900">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <CardTitle className="text-2xl">Analyse en cours...</CardTitle>
                <p className="text-sm text-slate-500">{loadingMessages[loadingMessageIndex]}</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Configuration terminée !</CardTitle>
                    <CardDescription className="mt-2 text-sm">
                      Votre environnement est prêt.
                    </CardDescription>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Profil détecté</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {computedProfile === 'INTERNATIONAL'
                      ? 'International'
                      : 'Local / Atelier'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {computedProfile === 'INTERNATIONAL'
                      ? 'Le plugin Global Control Tower est activé automatiquement.'
                      : 'Le mode BASIC est conservé, avec une vue simplifiée adaptée à votre activité.'}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Autonomie sélectionnée :{' '}
                    {autonomy === 'FULL_AUTOMATION' ? 'Automatisation complète' : 'Suggestion uniquement'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-3">
          {step === 1 && (
            <Button
              size="lg"
              disabled={!production || !storage}
              onClick={() => setStep(2)}
            >
              Continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 2 && (
            <>
              <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button
                size="lg"
                disabled={!autonomy}
                onClick={() => setStep(3)}
              >
                Lancer la configuration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <Button variant="outline" size="lg" onClick={() => router.push('/dashboard')}>
                Passer la visite
              </Button>
              <Button size="lg" className="px-8" onClick={() => setShowInteractiveTour(true)}>
                Lancer la visite interactive
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
