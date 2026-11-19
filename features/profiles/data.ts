import { requireUser } from '@/lib/auth/session'

export type Profile = {
  id: string
  display_name: string
  locale: 'th' | 'en'
  timezone: string
  avatar_path: string | null
}
export type PersonalSpace = {
  id: string
  kind: 'personal'
  name: string
}
export type PersonalIdentity = {
  id: string
  display_name: string
}

export async function loadMyProfile() {
  const { user, supabase } = await requireUser()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,display_name,locale,timezone,avatar_path')
    .eq('id', user.id).maybeSingle()
  const { data: personalSpace, error: spaceError } = await supabase
    .from('spaces').select('id,kind,name')
    .eq('owner_id',user.id).eq('kind','personal').maybeSingle()
  const { data: participant, error: participantError } = personalSpace
    ? await supabase.from('participants').select('id,display_name')
        .eq('space_id', personalSpace.id).eq('user_id',user.id).maybeSingle()
    : { data: null, error: null }
  return {
    user,
    profile: profile as Profile | null,
    personalSpace: personalSpace as PersonalSpace | null,
    participant: participant as PersonalIdentity | null,
    error: profileError ?? spaceError ?? participantError,
  }
}
