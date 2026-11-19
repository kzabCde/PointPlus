import { notFound } from 'next/navigation'
import { getSpaceContext } from '@/features/spaces/data'

export type ChildParticipant = {
  id: string
  display_name: string
  guardian_user_id: string
  created_at: string
  birth_year: number | null
  note: string | null
}
export async function loadFamilyChildren(spaceId: string): Promise<ChildParticipant[]> {
  const { supabase, space } = await getSpaceContext(spaceId)
  if (space.kind !== 'family') notFound()
  const { data: children, error } = await supabase
    .from('participants').select('id,display_name,guardian_user_id,created_at')
    .eq('space_id', spaceId).eq('kind','child').is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Cannot read family participants')
  if (!children?.length) return []
  const { data: profiles, error: profileError } = await supabase.from('child_profiles')
    .select('participant_id,birth_year,note')
    .eq('space_id', spaceId)
    .in('participant_id', children.map((child) => child.id))
  if (profileError) throw new Error('Cannot load permitted child profiles')
  const byId = new Map((profiles ?? []).map((profile) => [profile.participant_id, profile]))
  // RLS can hide sensitive child profile rows even when a participant is visible.
  // Do not substitute guessed child data or grant an unauthorized read.
  return children.map((child) => ({
    ...child,
    birth_year: byId.get(child.id)?.birth_year ?? null,
    note: byId.get(child.id)?.note ?? null,
  }))
}
