import LeiaGovernancePanel from '@/components/LeiaGovernancePanel'

export const dynamic = 'force-dynamic'

export default function GovernancePage() {
  return (
    <div className="space-y-5">
      <header className="border-b border-[#DDE5EE] bg-white px-6 py-4">
        <h1 className="font-serif text-[22px] font-bold leading-8 text-[#03182F]">
          Governance
        </h1>
        <p className="font-serif text-[14px] leading-6 text-[#6B7480]">
          Configure Leia autonomy, safety fuses, and founder availability posture.
        </p>
      </header>

      <div className="px-6">
        <LeiaGovernancePanel />
      </div>
    </div>
  )
}
