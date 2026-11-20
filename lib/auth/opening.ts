// Short-lived presentation hint. It is read only under the protected layout.
export const openingCookie = 'pointplus-opening'

export function opensProtectedBook(destination: string) {
  const pathname = destination.split(/[?#]/, 1)[0]
  return /^\/(?:rooms|dashboard|profile|spaces|onboarding)(?:\/|$)/.test(pathname) ||
    /^\/s\/[a-f\d-]{36}(?:\/|$)/.test(pathname)
}
