import { loadMyProfile } from '@/features/profiles/data'
import { listMySpaces, getSpaceContext, getSpaceMembers } from '@/features/spaces/data'
import { loadMissionBoard, windowState } from '@/features/missions/data'

export async function loadDashboard() {
  const [identity, spaces] = await Promise.all([loadMyProfile(), listMySpaces()])
  const summaries = await Promise.all(spaces.map(async space => {
    const [board, members] = await Promise.all([
      loadMissionBoard(space.id, { status: 'active' }), getSpaceMembers(space.id),
    ])
    const { supabase } = await getSpaceContext(space.id)
    const walletResult = board.selected
      ? await supabase.from('point_wallets').select('balance')
          .eq('space_id',space.id).eq('participant_id',board.selected.id).maybeSingle()
      : null
    if (walletResult?.error) throw new Error('Cannot load participant wallet')
    const active = board.missions.filter(m => m.status === 'active')
    return {
      space, role: board.member.role, memberCount: members.length,
      visibleParticipants: board.participants.length,
      participantName: board.selected?.display_name ?? null,
      activeCount: active.length,
      currentlyAvailable: active.filter(m => windowState(m) === 'available').length,
      assignedCount: active.filter(m => m.assignment_mode === 'assigned').length,
      points: walletResult?.data?.balance ?? null,
    }
  }))
  return { identity, summaries }
}
