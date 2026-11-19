import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { safeNextPath } from '@/lib/auth/redirects'

const otpTypes: readonly EmailOtpType[] = ['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = safeNextPath(url.searchParams.get('next'), '/dashboard')
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const otpType = url.searchParams.get('type')
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  } else if (tokenHash && otpType && otpTypes.includes(otpType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as EmailOtpType })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', url.origin))
}
