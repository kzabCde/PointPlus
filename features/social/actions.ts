'use server'

import { revalidatePath } from 'next/cache'
import { getSpaceContext, canManage } from '@/features/spaces/data'
import { getMissionDetail } from '@/features/missions/data'
import { canSubmitFor } from './data'
import { isUuid } from '@/lib/auth/validation'

export type ActionResult = { status: 'success' | 'error'; message: string }
export type SubmissionInput = {
  spaceId: string; missionId: string; participantId: string
  idempotencyKey: string; proofText?: string; proofPath?: string
}
function invalid(message: string): ActionResult { return {status:'error',message} }
function refresh(spaceId:string,missionId?:string) {
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
  revalidatePath('/s/'+spaceId)
  revalidatePath('/s/'+spaceId+'/missions')
  revalidatePath('/s/'+spaceId+'/daily')
  revalidatePath('/s/'+spaceId+'/progress')
  revalidatePath('/s/'+spaceId+'/reviews')
  if(missionId) revalidatePath('/s/'+spaceId+'/missions/'+missionId)
}

export async function submitMissionAction(input: SubmissionInput): Promise<ActionResult> {
  const {spaceId,missionId,participantId,idempotencyKey} = input
  if (![spaceId,missionId,participantId].every(isUuid) ||
    typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 120)
    return invalid('ข้อมูลการส่งภารกิจไม่ถูกต้อง')
  if (typeof input.proofText !== 'undefined' && (typeof input.proofText !== 'string' || input.proofText.length > 4000))
    return invalid('รายละเอียดต้องไม่เกิน 4,000 ตัวอักษร')
  if (typeof input.proofPath !== 'undefined' &&
    (typeof input.proofPath !== 'string' || input.proofPath.length > 500))
    return invalid('ไฟล์หลักฐานไม่ถูกต้อง')
  const detail = await getMissionDetail(spaceId,missionId,participantId)
  if (!detail.selected || detail.selected.id !== participantId ||
      !canSubmitFor(detail.selected,detail.user.id,detail.manager))
    return invalid('คุณไม่มีสิทธิ์ส่งภารกิจของผู้เข้าร่วมนี้')
  if (input.proofPath && !input.proofPath.startsWith(detail.user.id + '/'))
    return invalid('ไฟล์หลักฐานไม่ใช่ของบัญชีคุณ')
  // DB is responsible for recurrence, assignment, timing, duplicate and auto-approval.
  const { error } = await detail.supabase.rpc('pointplus_submit_mission',{
    p_mission:missionId, p_participant:participantId, p_idempotency_key:idempotencyKey,
    p_proof_text:input.proofText?.trim() || null, p_proof_path:input.proofPath || null,
  })
  if (error) return invalid(error.message || 'ส่งภารกิจไม่สำเร็จ')
  refresh(spaceId,missionId)
  return {status:'success',message:detail.space.kind === 'personal'
    ? 'บันทึกภารกิจแล้ว ระบบพื้นที่ส่วนตัวจะอนุมัติตามกติกาฐานข้อมูล'
    : 'ส่งภารกิจเรียบร้อยแล้ว รอผู้มีสิทธิ์ตรวจสอบ'}
}

export async function reviewMissionAction(
  _state: ActionResult, form: FormData,
): Promise<ActionResult> {
  const spaceId = String(form.get('space_id') ?? '')
  const submissionId = String(form.get('submission_id') ?? '')
  const decision = String(form.get('decision') ?? '')
  const note = String(form.get('note') ?? '').trim()
  if (![spaceId,submissionId].every(isUuid) || !['approve','reject'].includes(decision))
    return invalid('ข้อมูลการตรวจภารกิจไม่ถูกต้อง')
  if (note.length > 1000 || (decision === 'reject' && !note))
    return invalid('กรุณาระบุเหตุผลเมื่อไม่อนุมัติ (ไม่เกิน 1,000 ตัวอักษร)')
  const { supabase,user,space,member } = await getSpaceContext(spaceId)
  const { data: s, error: sError } = await supabase.from('mission_submissions')
    .select('id,space_id,participant_id,created_by,status')
    .eq('space_id',spaceId).eq('id',submissionId).maybeSingle()
  if(sError || !s || s.status !== 'submitted') return invalid('รายการนี้ไม่พร้อมตรวจสอบ')
  const {data:p,error:pError} = await supabase.from('participants')
    .select('id,kind,guardian_user_id').eq('space_id',spaceId)
    .eq('id',s.participant_id).maybeSingle()
  if(pError || !p) return invalid('ไม่พบผู้เข้าร่วมที่มีสิทธิ์')
  const allowed = space.kind === 'personal'
    ? s.created_by === user.id
    : p.kind === 'child'
      ? p.guardian_user_id === user.id || canManage(member.role)
      : s.created_by !== user.id
  if (!allowed) return invalid('คุณไม่มีสิทธิ์ตรวจภารกิจนี้')
  // The database locks the submission row and atomically awards any points/stamps once.
  const {error} = await supabase.rpc('pointplus_review_mission',{
    p_submission: submissionId,p_approve: decision==='approve',p_note: note || null,
  })
  if(error) return invalid(error.message || 'ตรวจภารกิจไม่สำเร็จ')
  refresh(spaceId)
  return {status:'success',message:decision==='approve'?'อนุมัติภารกิจแล้ว':'ไม่อนุมัติภารกิจและบันทึกเหตุผลแล้ว'}
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if(!isUuid(id)) return invalid('ไม่พบการแจ้งเตือน')
  const {supabase,user} = await import('@/lib/auth/session').then(m=>m.requireUser())
  const {data,error}=await supabase.from('notifications').update({read_at:new Date().toISOString()})
    .eq('id',id).eq('recipient_user_id',user.id).is('read_at',null)
    .select('id').maybeSingle()
  if(error) return invalid('ไม่สามารถบันทึกสถานะการอ่านได้')
  revalidatePath('/notifications')
  return {status:'success',message:data?'อ่านแล้ว':'รายการนี้อาจถูกอ่านไปก่อนหน้านี้'}
}
