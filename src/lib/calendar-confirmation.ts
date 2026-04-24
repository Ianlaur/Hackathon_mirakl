function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function normalizeConfirmationFlag(value: unknown) {
  if (value === true) return true

  const normalized = normalizeText(value)
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === 'oui'
}

export function requiresExplicitCalendarConfirmation(kind: string, confirmed: unknown) {
  return normalizeText(kind) === 'leave' && !normalizeConfirmationFlag(confirmed)
}
