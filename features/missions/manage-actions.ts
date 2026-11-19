'use server'

import { revalidatePath } from 'next/cache'
import { field, isUuid } from '@/lib/auth/validation'
import { getSpaceParticipants } from '@/features/spaces/data'
import { getManagerContext, getMissionCatalog, checkMissionCatalog } from './catalog'
import { getManagedMission } from './management'
import { parseMissionForm, parseTimeWindow } from './validation'
import type { MissionMutationState } from './create-actions'

const fail = (message:string): MissionMutationState => ({status:'error',message})
const ok = (message:string): MissionMutationState => ({status:'success',message})

function refresh(spaceId:string,missionId?:string) {
  revalidatePath('/dashboard')
  revalidatePath('/s/'+spaceId)
  revalidatePath('/s/'+spaceId+'/missions')
  if (missionId) {
    revalidatePath('/s/'+spaceId+'/missions/'+missionId)
    revalidatePath('/s/'+spaceId+'/missions/'+missionId+'/manage')
  }
}
export async function updateMissionAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId = field(form,'space_id'), missionId = field(form,'mission_id')
  if (!isUuid(spaceId) || !isUuid(missionId)) return fail('ไม่พบภารกิจ')
  const {supabase,space,mission} = await getManagedMission(spaceId,missionId)
  if (mission.status === 'archived') return fail('ภารกิจที่เก็บถาวรแล้วไม่สามารถแก้ไขได้')
  const parsed = parseMissionForm(form,space.timezone)
  if (!parsed.value) return fail(parsed.error ?? 'ข้อมูลภารกิจไม่ถูกต้อง')
  const catalog = await getMissionCatalog(spaceId)
  const problem = checkMissionCatalog(parsed.value,catalog)
  if (problem) return fail(problem)
  const {data,error} = await supabase.from('missions').update(parsed.value)
    .eq('space_id',spaceId).eq('id',missionId).eq('status',mission.status)
    .select('id').maybeSingle()
  if (error || !data) return fail('บันทึกไม่สำเร็จ ภารกิจอาจถูกเปลี่ยนสถานะโดยผู้ดูแลอีกคน')
  refresh(spaceId,missionId)
  return ok('อัปเดตภารกิจเรียบร้อยแล้ว')
}

export async function changeMissionStatusAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId = field(form,'space_id'), missionId = field(form,'mission_id')
  const target = field(form,'target')
  if (!isUuid(spaceId) || !isUuid(missionId) || !['active','archived'].includes(target)) return fail('คำขอไม่ถูกต้อง')
  if (field(form,'confirm') !== 'yes') return fail('กรุณายืนยันการเปลี่ยนสถานะ')
  const {supabase,mission} = await getManagedMission(spaceId,missionId)
  if (!(mission.status === 'draft' && target === 'active') &&
      !(mission.status === 'active' && target === 'archived'))
    return fail('ไม่สามารถเปลี่ยนสถานะจากสถานะปัจจุบันได้')
  if (target === 'active') {
    if (mission.ends_at && Date.parse(mission.ends_at) <= Date.now())
      return fail('ภารกิจนี้สิ้นสุดช่วงเวลาแล้ว กรุณาแก้ไขเวลาในหน้าจัดการก่อนเปิดใช้งาน')
    const catalog = await getMissionCatalog(spaceId)
    const problem = checkMissionCatalog(mission,catalog)
    if (problem) return fail(problem)
    if (mission.assignment_mode === 'assigned') {
      const {count,error} = await supabase.from('mission_assignments')
        .select('id',{count:'exact',head:true}).eq('space_id',spaceId).eq('mission_id',missionId)
      if (error || !count) return fail('ภารกิจแบบมอบหมายต้องมีผู้เข้าร่วมอย่างน้อยหนึ่งคนก่อนเปิดใช้งาน')
    }
  }
  const {data,error} = await supabase.from('missions').update({status:target})
    .eq('space_id',spaceId).eq('id',missionId).eq('status',mission.status)
    .select('id').maybeSingle()
  if (error || !data) return fail('เปลี่ยนสถานะไม่สำเร็จ กรุณาโหลดข้อมูลใหม่')
  refresh(spaceId,missionId)
  return ok(target==='active'?'เปิดใช้งานภารกิจแล้ว':'เก็บภารกิจเข้าคลังแล้ว โดยคงข้อมูลและประวัติเดิมไว้')
}

export async function addAssignmentAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId=field(form,'space_id'), missionId=field(form,'mission_id'), participantId=field(form,'participant_id')
  if (![spaceId,missionId,participantId].every(isUuid)) return fail('ข้อมูลผู้เข้าร่วมไม่ถูกต้อง')
  const {supabase,user,mission} = await getManagedMission(spaceId,missionId)
  if (mission.status==='archived') return fail('ไม่สามารถแก้ไขการมอบหมายของภารกิจที่เก็บถาวร')
  const participants = await getSpaceParticipants(spaceId)
  if (!participants.some(p=>p.id===participantId && p.space_id===spaceId && p.archived_at===null))
    return fail('ผู้เข้าร่วมไม่ได้อยู่ในพื้นที่นี้ หรือถูกปิดใช้งานแล้ว')
  const {error} = await supabase.from('mission_assignments')
    .insert({space_id:spaceId,mission_id:missionId,participant_id:participantId,assigned_by:user.id})
  if (error) return fail('เพิ่มผู้ได้รับมอบหมายไม่สำเร็จ อาจมีรายชื่อนี้อยู่แล้ว')
  refresh(spaceId,missionId)
  return ok('เพิ่มผู้ได้รับมอบหมายแล้ว')
}

export async function removeAssignmentAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId=field(form,'space_id'),missionId=field(form,'mission_id'),participantId=field(form,'participant_id')
  if (![spaceId,missionId,participantId].every(isUuid)) return fail('ข้อมูลไม่ถูกต้อง')
  if (field(form,'confirm')!=='yes') return fail('กรุณายืนยันการยกเลิกมอบหมาย')
  const {supabase,mission} = await getManagedMission(spaceId,missionId)
  if (mission.status==='archived') return fail('ไม่สามารถแก้ไขการมอบหมายของภารกิจที่เก็บถาวร')
  // Composite foreign keys and Space-scoped filters prevent cross-Space mutations.
  const {data,error} = await supabase.from('mission_assignments').delete()
    .eq('space_id',spaceId).eq('mission_id',missionId).eq('participant_id',participantId)
    .select('id')
  if (error || !data?.length) return fail('ไม่สามารถยกเลิกการมอบหมายนี้ได้')
  refresh(spaceId,missionId)
  return ok('ยกเลิกการมอบหมายแล้ว')
}

function campaignFields(form:FormData,zone:string) {
  const title=field(form,'title'), description=field(form,'description')
  if (title.length < 1 || title.length > 120) return {error:'ชื่อชุดภารกิจต้องยาว 1–120 ตัวอักษร'} as const
  if (description.length > 4000) return {error:'คำอธิบายต้องไม่เกิน 4,000 ตัวอักษร'} as const
  const times=parseTimeWindow(form,zone)
  if (!times.value) return {error:times.error ?? 'ช่วงเวลาไม่ถูกต้อง'} as const
  return {value:{title,description:description||null,start_at:times.value.starts_at,end_at:times.value.ends_at}} as const
}
export async function createCampaignAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId=field(form,'space_id')
  if (!isUuid(spaceId)) return fail('พื้นที่ไม่ถูกต้อง')
  const {supabase,user,space}=await getManagerContext(spaceId)
  const data=campaignFields(form,space.timezone)
  if (!data.value) return fail(data.error ?? 'ข้อมูลชุดภารกิจไม่ถูกต้อง')
  const {data:created,error}=await supabase.from('campaigns')
    .insert({...data.value,space_id:spaceId,created_by:user.id}).select('id').single()
  if (error || !created) return fail('ไม่สามารถสร้างชุดภารกิจได้')
  revalidatePath('/s/'+spaceId+'/campaigns')
  revalidatePath('/s/'+spaceId+'/missions/new')
  return {status:'success',message:'สร้างชุดภารกิจเรียบร้อยแล้ว',missionId:created.id}
}
export async function updateCampaignAction(
  _state:MissionMutationState,form:FormData,
):Promise<MissionMutationState> {
  const spaceId=field(form,'space_id'), campaignId=field(form,'campaign_id')
  if (!isUuid(spaceId) || !isUuid(campaignId)) return fail('ไม่พบชุดภารกิจ')
  const {supabase,space}=await getManagerContext(spaceId)
  const input=campaignFields(form,space.timezone)
  if (!input.value) return fail(input.error ?? 'ข้อมูลชุดภารกิจไม่ถูกต้อง')
  const {data,error}=await supabase.from('campaigns').update(input.value)
    .eq('space_id',spaceId).eq('id',campaignId).select('id').maybeSingle()
  if (error || !data) return fail('ไม่สามารถบันทึกชุดภารกิจได้')
  revalidatePath('/s/'+spaceId+'/campaigns')
  revalidatePath('/s/'+spaceId+'/campaigns/'+campaignId)
  revalidatePath('/s/'+spaceId+'/missions')
  return ok('บันทึกชุดภารกิจแล้ว')
}
