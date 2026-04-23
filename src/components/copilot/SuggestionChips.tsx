'use client'

interface SuggestionChipsProps {
  suggestions: string[]
  selected: string | null
  loading: boolean
  onSelect: (question: string) => void
}

export default function SuggestionChips({
  suggestions,
  selected,
  loading,
  onSelect,
}: SuggestionChipsProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {suggestions.map((question) => {
        const isSelected = selected === question

        return (
          <button
            key={question}
            type="button"
            disabled={loading}
            onClick={() => onSelect(question)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-[#30373E] hover:border-[#BFCBDA] hover:bg-slate-50'
            }`}
          >
            {question}
          </button>
        )
      })}
    </div>
  )
}
