import { notFound } from 'next/navigation'
import { isUuid } from '@/lib/auth/validation'
import { getManagerContext } from './catalog'
import type { Mission } from './data'

export async function getManagedMission(spaceId: string, missionId: string) {
  if (!isUuid(missionId)) notFound()
  const context = await getManagerContext(spaceId)
  const { data, error } = await context.supabase.from('missions')
    .select('id,space_id,campaign_id,stamp_card_id,title,description,frequency,assignment_mode,points_reward,stamps_reward,max_completions,status,starts_at,ends_at,created_at')
    .eq('space_id',spaceId).eq('id',missionId).maybeSingle()
  if (error) throw new Error('Cannot load managed mission')
  if (!data) notFound()
  return { ...context, mission: data as Mission }
}
export async function getMissionAssignments(spaceId: string, missionId: string) {
  const { supabase } = await getManagedMission(spaceId, missionId)
  const { data, error } = await supabase.from('mission_assignments')
    .select('id,mission_id,participant_id,assigned_at')
    .eq('space_id',spaceId).eq('mission_id',missionId).order('assigned_at')
  if (error) throw new Error('Cannot load mission assignments')
  return (data ?? []) as Array<{
    id:string; mission_id:string; participant_id:string; assigned_at:string
  }>
}
