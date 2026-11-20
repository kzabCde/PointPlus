export function safeNextPath(raw: string | null | undefined, fallback = '/rooms'): string {
  if (!raw || raw.length > 600 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\r\n\x00-\x1f]/.test(raw)) {
    return fallback
  }
  // Auth redirects stay within documented app routes. No external redirects.
  if (!/^(\/dashboard(?:[/?#]|$)|\/rooms(?:[/?#]|$)|\/profile(?:[/?#]|$)|\/spaces(?:[/?#]|$)|\/s\/[a-f\d-]{36}(?:[/?#]|$)|\/join(?:[/?#]|$)|\/auth\/reset-password(?:[/?#]|$)|\/onboarding(?:[/?#]|$))/.test(raw)) return fallback
  return raw
}

export function siteOrigin(): string {
  // Invitation and auth links must use a stable public origin, not a per-deployment URL.
  // NEXT_PUBLIC_SITE_URL is supported for existing environments.
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (configured) {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('PointPlus site URL must use HTTP(S)')
    return url.origin
  }
  if (process.env.NODE_ENV === 'production') {
    // Vercel's stable project production hostname is preferable to VERCEL_URL,
    // which can point to a deployment protected by Vercel Authentication.
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (productionHost) return new URL('https://' + productionHost).origin
    // Backward compatibility when neither canonical option is available.
    const deploymentHost = process.env.VERCEL_URL
    if (deploymentHost) return 'https://' + deploymentHost
  }
  return 'http://localhost:3000'
}
