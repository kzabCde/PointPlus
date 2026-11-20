import { notFound } from 'next/navigation'
import { cache } from 'react'
import { requireUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/auth/validation'

export type SpaceKind = 'personal' | 'couple' | 'family' | 'group'
export type SpaceRole = 'owner' | 'admin' | 'member'
export type Space = {
  id: string
  owner_id: string
  kind: SpaceKind
  name: string
}
export type Membership = { space_id: string; user_id: string; role: SpaceRole; joined_at: string }
export type SpaceWithRole = Space & { role: SpaceRole }
export type Participant = {
  id: string
  space_id: string
  kind: 'adult' | 'child'
  user_id: string | null
  guardian_user_id: string | null
  display_name: string
  archived_at: string | null
}
export const canManage = (role: SpaceRole) => role === 'owner' || role === 'admin'

export const listMySpaces = cache(async (): Promise<SpaceWithRole[]> => {
  const { user, supabase } = await requireUser()
  const { data: memberships, error: membershipError } = await supabase
    .from('space_members').select('space_id,role').eq('user_id', user.id)
  if (membershipError) throw new Error('Cannot load space memberships')
  if (!memberships?.length) return []
  const { data: spaces, error: spaceError } = await supabase.from('spaces')
    .select('id,owner_id,kind,name').in('id', memberships.map((m) => m.space_id))
  if (spaceError) throw new Error('Cannot load spaces')
  return (spaces ?? []).map((space) => ({
    ...(space as Space),
    role: memberships.find((m) => m.space_id === space.id)?.role as SpaceRole,
  })).sort((a,b) => (a.kind === 'personal' ? -1 : 0) - (b.kind === 'personal' ? -1 : 0))
})

export const getSpaceContext = cache(async (id: string) => {
  if (!isUuid(id)) notFound()
  const { supabase, user } = await requireUser()
  const { data: member, error: memberError } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at').eq('space_id', id).eq('user_id', user.id).maybeSingle()
  if (memberError) throw new Error('Cannot verify space membership')
  if (!member) notFound()
  const { data: space, error: spaceError } = await supabase.from('spaces')
    .select('id,owner_id,kind,name').eq('id', id).maybeSingle()
  if (spaceError) throw new Error('Cannot load space')
  if (!space) notFound()
  return { supabase, user, member: member as Membership, space: space as Space }
})

export async function getSpaceMembers(spaceId: string): Promise<Membership[]> {
  const { supabase } = await getSpaceContext(spaceId)
  const { data, error } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at').eq('space_id',spaceId).order('joined_at')
  if (error) throw new Error('Cannot load members')
  return (data ?? []) as Membership[]
}

export async function getSpaceParticipants(spaceId: string, { includeArchived = false } = {}): Promise<Participant[]> {
  const { supabase } = await getSpaceContext(spaceId)
  const query = supabase.from('participants')
    .select('id,space_id,kind,user_id,guardian_user_id,display_name,archived_at')
    .eq('space_id', spaceId)
  if (!includeArchived) query.is('archived_at', null)
  const { data, error } = await query.order('created_at')
  if (error) throw new Error('Cannot load participants')
  return (data ?? []) as Participant[]
}

/** Shared Rooms only; legacy personal data stays accessible but off the room launcher. */
export async function listMyRooms(): Promise<SpaceWithRole[]> {
  return (await listMySpaces()).filter((space) => space.kind !== 'personal')
}
