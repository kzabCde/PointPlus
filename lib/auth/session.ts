import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/login')
  return { supabase, user: data.user }
}

export const getClaims = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getClaims()
})
