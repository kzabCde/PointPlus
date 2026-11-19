export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || raw.length > 600 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\r\n\x00-\x1f]/.test(raw)) {
    return fallback
  }
  // Auth redirects stay within documented app routes. No external redirects.
  if (!/^(\/dashboard(?:[/?#]|$)|\/profile(?:[/?#]|$)|\/spaces(?:[/?#]|$)|\/s\/[a-f\d-]{36}(?:[/?#]|$)|\/join(?:[/?#]|$)|\/onboarding(?:[/?#]|$))/.test(raw)) return fallback
  return raw
}

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return new URL(configured).origin
  if (process.env.NODE_ENV === 'production') {
    // No user-controlled request headers are trusted as an OAuth redirect host.
    // On Vercel, use the deployment host only when the explicit canonical URL is absent.
    const vercelHost = process.env.VERCEL_URL
    if (vercelHost) return 'https://' + vercelHost
  }
  return 'http://localhost:3000'
}
