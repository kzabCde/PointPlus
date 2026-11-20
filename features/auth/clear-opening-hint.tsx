'use client'

import { useEffect } from 'react'
import { openingCookie } from '@/lib/auth/opening'

export function ClearOpeningHint() {
  useEffect(() => {
    document.cookie = openingCookie + '=; Max-Age=0; Path=/; SameSite=Lax' +
      (window.location.protocol === 'https:' ? '; Secure' : '')
  }, [])

  return null
}
