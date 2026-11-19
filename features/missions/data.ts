import { notFound } from 'next/navigation'
import { getSpaceContext, getSpaceParticipants, canManage, type Participant } from '@/features/spaces/data'
import { isUuid } from '@/lib/auth/validation'

export type MissionStatus = 'draft' | 'active' | 'archived'
export type MissionFrequency = 'once' | 'daily' | 'weekly' | 'repeatable'
export type AssignmentMode = 'open' | 'assigned'
export type Mission = {
  id: string; space_id: string; campaign_id: string | null; stamp_card_id: string | null
  title: string; description: string | null; frequency: MissionFrequency
  assignment_mode: AssignmentMode; points_reward: number; stamps_reward: number
  max_completions: number | null; status: MissionStatus
  starts_at: string | null; ends_at: string | null; created_at: string
}
export type Assignment = { mission_id: string; participant_id: string }
export type CatalogItem = { id: string; title: string }
export type BoardFilters = { participant?: string; search?: string; frequency?: string; mode?: string; status?: string }
export const frequencyLabels: Record<MissionFrequency, string> = {
  once: 'ครั้งเดียว', daily: 'รายวัน', weekly: 'รายสัปดาห์', repeatable: 'ทำซ้ำได้',
}
export const statusLabels: Record<MissionStatus, string> = {
  draft: 'ร่าง', active: 'เปิดใช้งาน', archived: 'เก็บถาวร',
}
export const modeLabels: Record<AssignmentMode, string> = {
  open: 'ทุกคนในพื้นที่', assigned: 'เฉพาะผู้ที่ได้รับมอบหมาย',
}
export function windowState(mission: Mission, now = Date.now()): 'upcoming' | 'ended' | 'available' {
  if (mission.starts_at && Date.parse(mission.starts_at) > now) return 'upcoming'
  if (mission.ends_at && Date.parse(mission.ends_at) <= now) return 'ended'
  return 'available'
}
function canSelect(participant: Participant, userId: string, manager: boolean) {
  return manager || participant.user_id === userId ||
    (participant.kind === 'child' && participant.guardian_user_id === userId)
}
export async function loadMissionBoard(spaceId: string, filters: BoardFilters = {}) {
  const { space, member, supabase, user } = await getSpaceContext(spaceId)
  const manager = canManage(member.role)
  const participants = (await getSpaceParticipants(spaceId)).filter((p) => canSelect(p, user.id, manager))
  const own = participants.find((p) => p.user_id === user.id)
  const selected = participants.find((p) => p.id === filters.participant) ?? own ?? participants[0] ?? null
  if (!selected) return { space, member, manager, participants, selected,
    missions: [] as Mission[], assignments: [] as Assignment[], campaigns: [] as CatalogItem[],
    stampCards: [] as CatalogItem[] }

  const [missionResult, assignmentResult, campaignResult, cardResult] = await Promise.all([
    supabase.from('missions')
      .select('id,space_id,campaign_id,stamp_card_id,title,description,frequency,assignment_mode,points_reward,stamps_reward,max_completions,status,starts_at,ends_at,created_at')
      .eq('space_id',spaceId).order('created_at',{ ascending: false }),
    supabase.from('mission_assignments').select('mission_id,participant_id').eq('space_id',spaceId),
    supabase.from('campaigns').select('id,title').eq('space_id',spaceId),
    supabase.from('stamp_cards').select('id,title').eq('space_id',spaceId),
  ])
  if (missionResult.error || assignmentResult.error || campaignResult.error || cardResult.error)
    throw new Error('Cannot load mission board')
  const assignments = (assignmentResult.data ?? []) as Assignment[]
  const assigned = new Set(assignments.filter((a) => a.participant_id === selected.id).map((a) => a.mission_id))
  const allowed = manager ? ['active','draft','archived'] : ['active']
  const wantedStatus = allowed.includes(filters.status ?? '') ? filters.status : 'active'
  const search = (filters.search ?? '').slice(0,160).trim().toLocaleLowerCase()
  const frequency = ['once','daily','weekly','repeatable'].includes(filters.frequency ?? '') ? filters.frequency : ''
  const mode = ['open','assigned'].includes(filters.mode ?? '') ? filters.mode : ''
  const missions = ((missionResult.data ?? []) as Mission[]).filter((m) =>
    (m.assignment_mode === 'open' || assigned.has(m.id)) &&
    (manager || m.status === 'active') && m.status === wantedStatus &&
    (!search || m.title.toLocaleLowerCase().includes(search)) &&
    (!frequency || m.frequency === frequency) &&
    (!mode || m.assignment_mode === mode))
  return { space, member, manager, participants, selected, missions, assignments,
    campaigns: (campaignResult.data ?? []) as CatalogItem[],
    stampCards: (cardResult.data ?? []) as CatalogItem[] }
}
export async function getMissionDetail(spaceId: string, missionId: string, participantId?: string) {
  if (!isUuid(missionId)) notFound()
  const board = await loadMissionBoard(spaceId, { participant: participantId })
  const { supabase } = await getSpaceContext(spaceId)
  const { data, error } = await supabase.from('missions')
    .select('id,space_id,campaign_id,stamp_card_id,title,description,frequency,assignment_mode,points_reward,stamps_reward,max_completions,status,starts_at,ends_at,created_at')
    .eq('space_id',spaceId).eq('id',missionId).maybeSingle()
  if (error) throw new Error('Cannot load mission detail')
  const mission = data as Mission | null
  if (!mission || !board.selected) notFound()
  if (!board.manager && mission.status !== 'active') notFound()
  if (mission.assignment_mode === 'assigned' &&
    !board.assignments.some((a) => a.mission_id === missionId && a.participant_id === board.selected?.id)) notFound()
  return { ...board, mission }
}
