import { getSpaceContext, getSpaceParticipants, canManage } from '@/features/spaces/data'

export type RoomActivityPreview = {
  id: string; title: string; description: string | null; created_at: string
}
/** Strictly scoped, capped Room Home query: no cross-Space dashboard fan-out. */
export async function loadRoomActivityPreview(spaceId: string): Promise<RoomActivityPreview[]> {
  const { user, supabase, member } = await getSpaceContext(spaceId)
  const preview = 'id,title,description,created_at'
  if (canManage(member.role)) {
    const { data, error } = await supabase.from('missions').select(preview)
      .eq('space_id', spaceId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(4)
    if (error) throw new Error('Cannot load active Room activities')
    return (data ?? []) as RoomActivityPreview[]
  }

  // Non-managers see active open missions and those assigned to their
  // own adult participant. No broad listing of other members' assignments.
  const { data: self, error: participantError } = await supabase.from('participants')
    .select('id').eq('space_id',spaceId).eq('user_id',user.id).maybeSingle()
  if (participantError) throw new Error('Cannot load participant')
  if (!self) return []

  const [open, assignments] = await Promise.all([
    supabase.from('missions').select(preview).eq('space_id',spaceId)
      .eq('status','active').eq('assignment_mode','open')
      .order('created_at',{ascending:false}).limit(4),
    supabase.from('mission_assignments').select('mission_id')
      .eq('space_id',spaceId).eq('participant_id',self.id).limit(200),
  ])
  if (open.error || assignments.error) throw new Error('Cannot load eligible Room activities')
  const ids = [...new Set((assignments.data ?? []).map(a => a.mission_id))]
  const assigned = ids.length
    ? await supabase.from('missions').select(preview).eq('space_id',spaceId)
        .eq('status','active').eq('assignment_mode','assigned').in('id',ids)
        .order('created_at',{ascending:false}).limit(4)
    : { data: [], error: null }
  if (assigned.error) throw new Error('Cannot load assigned Room activities')
  const combined = [...(open.data ?? []),...(assigned.data ?? [])] as RoomActivityPreview[]
  return [...new Map(combined.map(m => [m.id,m])).values()]
    .sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,4)
}
