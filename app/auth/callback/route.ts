import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { safeNextPath } from '@/lib/auth/redirects'

const otpTypes: readonly EmailOtpType[] = ['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']

function redirectWithinApp(path: string, requestUrl: URL) {
  // The request URL may contain Next's internal host. A relative Location
  // keeps the browser on the origin where the session cookies were set.
  const target = new URL(path, requestUrl.origin)
  const location = target.pathname.startsWith('//')
    ? '/rooms' : target.pathname + target.search + target.hash
  return new NextResponse(null, { status: 307, headers: { Location: location } })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = safeNextPath(url.searchParams.get('next'), '/dashboard')
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const otpType = url.searchParams.get('type')
  const supabase = await createClient()

  // Complete the display name set during registration after email verification.
  async function finishSignIn() {
    const { data: { user } } = await supabase.auth.getUser()
    const name = user?.user_metadata?.display_name
    if (user && typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 80) {
      await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id).eq('display_name', 'Member')
    }
    return redirectWithinApp(next, url)
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return finishSignIn()
  } else if (tokenHash && otpType && otpTypes.includes(otpType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as EmailOtpType })
    if (!error) return finishSignIn()
  }
  return redirectWithinApp('/login?error=confirmation', url)
}
