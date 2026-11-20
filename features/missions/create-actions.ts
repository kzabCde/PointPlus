'use server'

import { revalidatePath } from 'next/cache'
import { field, isUuid } from '@/lib/auth/validation'
import { getMissionCatalog, getManagerContext, checkMissionCatalog } from './catalog'
import { parseMissionForm, parseCreationStatus } from './validation'

export type MissionMutationState = {
  status: 'idle' | 'success' | 'error'
  message: string
  missionId?: string
}
export async function createMissionAction(
  _state: MissionMutationState, form: FormData,
): Promise<MissionMutationState> {
  const spaceId = field(form,'space_id')
  if (!isUuid(spaceId)) return {status:'error',message:'พื้นที่ไม่ถูกต้อง'}
  const { supabase, user, space } = await getManagerContext(spaceId)
  const parsed = parseMissionForm(form,'Asia/Bangkok')
  if (!parsed.value) return {status:'error',message:parsed.error ?? 'ข้อมูลภารกิจไม่ถูกต้อง'}
  const status = parseCreationStatus(form)
  if (!status.value) return {status:'error',message:status.error ?? 'สถานะไม่ถูกต้อง'}
  const catalog = await getMissionCatalog(spaceId)
  const problem = checkMissionCatalog(parsed.value,catalog)
  if (problem) return {status:'error',message:problem}
  const {data,error} = await supabase.from('missions')
    .insert({...parsed.value,status:status.value,space_id:spaceId,created_by:user.id})
    .select('id').single()
  if (error || !data) return {status:'error',message:'ไม่สามารถสร้างภารกิจได้ โปรดตรวจสอบข้อมูลและสิทธิ์ของคุณ'}
  revalidatePath('/s/' + spaceId)
  revalidatePath('/s/' + spaceId + '/missions')
  revalidatePath('/dashboard')
  return {status:'success',message:'สร้างภารกิจเรียบร้อยแล้ว',missionId:data.id}
}
