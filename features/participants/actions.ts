'use server'

import { revalidatePath } from 'next/cache'
import { field, isUuid } from '@/lib/auth/validation'
import { getSpaceContext } from '@/features/spaces/data'

export type ChildState = { status: 'idle' | 'error' | 'success'; message: string; participantId?: string }
export async function createChildAction(_state: ChildState, form: FormData): Promise<ChildState> {
  const spaceId = field(form,'space_id')
  const displayName = field(form,'display_name')
  const yearString = field(form,'birth_year')
  const note = field(form,'note')
  if (!isUuid(spaceId)) return { status:'error', message:'พื้นที่ไม่ถูกต้อง' }
  if (displayName.length < 1 || displayName.length > 80)
    return { status:'error', message:'ชื่อเด็กต้องยาว 1–80 ตัวอักษร' }
  if (note.length > 500) return { status:'error', message:'หมายเหตุยาวได้ไม่เกิน 500 ตัวอักษร' }
  const year = yearString === '' ? null : Number(yearString)
  if (year !== null && (!/^\d{4}$/.test(yearString) || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()))
    return { status:'error', message:'ปีเกิดไม่ถูกต้อง' }
  const { supabase, space } = await getSpaceContext(spaceId)
  if (space.kind !== 'family') return { status:'error', message:'เพิ่มเด็กได้เฉพาะพื้นที่ครอบครัว' }
  // The dedicated RPC sets current user as guardian and provisions the wallet.
  const { data, error } = await supabase.rpc('pointplus_create_child', {
    p_space: spaceId,
    p_display_name: displayName,
    p_birth_year: year,
    p_note: note || null,
  })
  if (error || typeof data !== 'string' || !isUuid(data))
    return { status:'error', message:'สร้างโปรไฟล์เด็กไม่สำเร็จ โปรดตรวจสอบสิทธิ์และข้อมูล' }
  revalidatePath('/s/' + spaceId)
  revalidatePath('/s/' + spaceId + '/children')
  return { status:'success', message:'เพิ่มเด็กในครอบครัวแล้ว', participantId: data }
}
