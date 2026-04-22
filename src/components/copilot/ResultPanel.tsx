'use client'

interface ResultPanelProps {
  content: string
  accentColor: string
}

function parseLines(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function ResultPanel({ content, accentColor }: ResultPanelProps) {
  const lines = parseLines(content)

  if (lines.length === 0) {
    return <p className="text-sm leading-7 text-slate-600">Aucun detail disponible pour le moment.</p>
  }

  const looksLikeList = lines.length > 1

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: `${accentColor}0A`,
        borderColor: `${accentColor}33`,
      }}
    >
      {looksLikeList ? (
        <ul className="space-y-2 text-sm leading-7 text-slate-700">
          {lines.map((line, index) => {
            const normalized = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')
            return <li key={`${line}-${index}`}>• {normalized}</li>
          })}
        </ul>
      ) : (
        <p className="text-sm leading-7 text-slate-700">{lines[0]}</p>
      )}
    </div>
  )
}
