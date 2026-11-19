import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // Both request and response cookies must be updated after refresh.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
          // Never cache refreshed auth cookies in a shared CDN.
          Object.entries(headers).forEach(([name, value]) => {
            supabaseResponse.headers.set(name, value)
          })
        },
      },
    },
  )

  // This verifies the JWT and refreshes expired credentials when needed.
  // Do not add unrelated logic between client creation and this call.
  await supabase.auth.getClaims()

  // No blanket redirect: PointPlus has not added login or protected routes yet.
  return supabaseResponse
}
