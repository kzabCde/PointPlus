import { notFound } from 'next/navigation'
import { getSpaceContext, getSpaceParticipants, canManage, type Participant } from '@/features/spaces/data'
import { getMissionDetail, windowState, type Mission } from '@/features/missions/data'
import { isUuid } from '@/lib/auth/validation'

export type Submission = {
  id: string; space_id: string; mission_id: string; participant_id: string
  occurrence_key: string; proof_text: string | null; proof_path: string | null
  status: 'submitted' | 'approved' | 'rejected'; points_snapshot: number
  created_by: string; reviewed_by: string | null; review_note: string | null
  submitted_at: string; reviewed_at: string | null
}
export type Transaction = {
  id: string; participant_id: string; amount: number; balance_after: number
  source_type: string; source_id: string; created_at: string
}
const submissionFields = 'id,space_id,mission_id,participant_id,occurrence_key,proof_text,proof_path,status,points_snapshot,created_by,reviewed_by,review_note,submitted_at,reviewed_at'

export function canSubmitFor(participant: Participant, userId: string, isManager: boolean) {
  return participant.archived_at === null &&
    (participant.user_id === userId ||
      (participant.kind === 'child' &&
        (participant.guardian_user_id === userId || isManager)))
}

/** This is a display hint. The database RPC is the sole authority for eligibility. */
export function localPeriodKey(frequency: Mission['frequency'], timezone: string, at = new Date()) {
  if (frequency === 'once') return 'once'
  if (frequency === 'repeatable') return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at)
  const val = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const date = `${val('year')}-${val('month')}-${val('day')}`
  if (frequency === 'daily') return date
  // ISO week in the Space's calendar (including the ISO week-year boundary).
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil((((d.getTime() - start.getTime()) / 86400000) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}
export function missionAvailability(mission: Mission, rows: Submission[], timezone: string) {
  const approved = rows.filter(s => s.status === 'approved').length
  if (mission.status !== 'active' || windowState(mission) !== 'available' ||
      (mission.max_completions !== null && approved >= mission.max_completions))
    return 'unavailable' as const
  const key = localPeriodKey(mission.frequency, timezone)
  const current = key === null ? [] : rows.filter(s => s.occurrence_key === key)
  if (current.some(s => s.status === 'submitted')) return 'pending' as const
  if (current.some(s => s.status === 'approved')) return 'approved' as const
  return 'available' as const
}
export const availabilityLabels = {
  available: 'พร้อมส่งภารกิจ', pending: 'รอการตรวจ', approved: 'สำเร็จแล้วในรอบนี้',
  unavailable: 'ยังไม่สามารถส่งภารกิจได้',
} as const

export async function loadMissionSubmissions(spaceId: string, missionId: string, participantId?: string) {
  const detail = await getMissionDetail(spaceId, missionId, participantId)
  if (!detail.selected) notFound()
  const { supabase, user } = await getSpaceContext(spaceId)
  const { data, error } = await supabase.from('mission_submissions')
    .select(submissionFields).eq('space_id', spaceId).eq('mission_id', missionId)
    .eq('participant_id', detail.selected.id).order('submitted_at', { ascending: false }).limit(100)
  if (error) throw new Error('Cannot load authorized submission history')
  const submissions = (data ?? []) as Submission[]
  return { ...detail, submissions,
    availability: missionAvailability(detail.mission, submissions, detail.'Asia/Bangkok'),
    canSubmit: canSubmitFor(detail.selected, user.id, detail.manager) }
}

export async function loadReviewQueue(spaceId: string) {
  const context = await getSpaceContext(spaceId)
  const participants = await getSpaceParticipants(spaceId)
  const byId = new Map(participants.map(p => [p.id, p]))
  const { data, error } = await context.supabase.from('mission_submissions')
    .select(submissionFields).eq('space_id',spaceId).eq('status','submitted')
    .order('submitted_at',{ascending:true}).limit(100)
  if (error) throw new Error('Cannot load review queue')
  // Mirrors v2 review_mission gate for UI; the RPC independently revalidates it.
  const queue = ((data ?? []) as Submission[]).filter(s => {
    const p = byId.get(s.participant_id)
    if (!p) return false
    if (context.space.kind === 'personal') return s.created_by === context.user.id
    if (p.kind === 'child') return p.guardian_user_id === context.user.id || canManage(context.member.role)
    return s.created_by !== context.user.id
  })
  const missionIds = [...new Set(queue.map(s => s.mission_id))]
  const { data: missions, error: missionError } = missionIds.length
    ? await context.supabase.from('missions').select('id,title,points_reward').eq('space_id',spaceId).in('id',missionIds)
    : { data: [], error: null }
  if (missionError) throw new Error('Cannot load review mission titles')
  const byMission = new Map((missions ?? []).map(m => [m.id,m]))
  return { ...context, queue: queue.map(submission => ({
    submission, participant: byId.get(submission.participant_id)!,
    mission: byMission.get(submission.mission_id) ?? null,
  })) }
}

export async function loadPointLedger(spaceId: string, participantId: string) {
  if (!isUuid(participantId)) notFound()
  const context = await getSpaceContext(spaceId)
  const participants = await getSpaceParticipants(spaceId)
  if (!participants.some(p => p.id === participantId &&
    (canSubmitFor(p,context.user.id,canManage(context.member.role)) || canManage(context.member.role))))
    notFound()
  const [wallet, transactions] = await Promise.all([
    context.supabase.from('point_wallets').select('balance,lifetime_earned')
      .eq('space_id',spaceId).eq('participant_id',participantId).maybeSingle(),
    context.supabase.from('point_transactions')
      .select('id,participant_id,amount,balance_after,source_type,source_id,created_at')
      .eq('space_id',spaceId).eq('participant_id',participantId)
      .order('created_at',{ascending:false}).limit(30),
  ])
  if (wallet.error || transactions.error) throw new Error('Cannot load points')
  return { wallet: wallet.data, transactions: (transactions.data ?? []) as Transaction[] }
}

export async function loadProgress(spaceId: string, offset = 0, participantId?: string) {
  const context = await getSpaceContext(spaceId)
  const participants = await getSpaceParticipants(spaceId)
  if (participantId && (!isUuid(participantId) || !participants.some(p => p.id === participantId)))
    notFound()
  const byId = new Map(participants.map(p => [p.id,p]))
  const safeOffset = Number.isSafeInteger(offset) ? Math.min(Math.max(offset,0),10000) : 0

  let pageQuery = context.supabase.from('mission_submissions')
    .select(submissionFields,{count:'exact'}).eq('space_id',spaceId)
  if (participantId) pageQuery = pageQuery.eq('participant_id',participantId)
  const pagePromise = pageQuery.order('submitted_at',{ascending:false}).range(safeOffset,safeOffset+19)
  const countsPromise = (['submitted','approved','rejected'] as const).map(status => {
    let q = context.supabase.from('mission_submissions').select('id',{count:'exact',head:true})
      .eq('space_id',spaceId).eq('status',status)
    if (participantId) q = q.eq('participant_id',participantId)
    return q
  })
  const [page, ...summary] = await Promise.all([pagePromise,...countsPromise])
  if (page.error || summary.some(result => result.error)) throw new Error('Cannot load activity')
  const records = ((page.data ?? []) as Submission[]).filter(s => byId.has(s.participant_id))
  const ids = [...new Set(records.map(s => s.mission_id))]
  const { data: missions, error: mError } = ids.length
    ? await context.supabase.from('missions').select('id,title').eq('space_id',spaceId).in('id',ids)
    : {data:[],error:null}
  if (mError) throw new Error('Cannot load activity titles')
  const names = new Map((missions ?? []).map(m => [m.id,m.title]))
  return { ...context, participants, count: page.count ?? 0, offset: safeOffset,
    selectedParticipant: participantId ?? null,
    counts: { pending:summary[0].count??0, approved:summary[1].count??0, rejected:summary[2].count??0 },
    activity: records.map(s => ({
      ...s, participantName: byId.get(s.participant_id)?.display_name ?? '',
      missionTitle: names.get(s.mission_id) ?? 'ภารกิจ',
    })) }
}
