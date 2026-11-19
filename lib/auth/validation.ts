export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
export const field = (data: FormData, key: string) => {
  const value = data.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
export const allowedTimezone = (value: string) => {
  if (!value || value.length > 80) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}
