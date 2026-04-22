export function serializeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
