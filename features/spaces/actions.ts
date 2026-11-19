'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { allowedTimezone, field, isUuid } from '@/lib/auth/validation'
import { requireUser } from '@/lib/auth/session'
import { getSpaceContext } from './data'

export type SpaceState = {
  status: 'idle' | 'error' | 'success'
  message: string
  spaceId?: string
}

export async function createSpaceAction(_state: SpaceState, form: FormData): Promise<SpaceState> {
  const kind = field(form, 'kind')
  const name = field(form, 'name')
  const submittedTimezone = field(form, 'timezone')
  if (kind !== 'couple' && kind !== 'family' && kind !== 'group') return { status:'error', message:'ประเภทพื้นที่ไม่ถูกต้อง' }
  if (name.length < 1 || name.length > 100) return { status:'error', message:'ชื่อพื้นที่ต้องยาว 1–100 ตัวอักษร' }
  const { user, supabase } = await requireUser()
  const { data: ownerProfile } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const timezone = submittedTimezone || ownerProfile?.timezone || 'Asia/Bangkok'
  if (!allowedTimezone(timezone)) return { status:'error', message:'เขตเวลาไม่ถูกต้อง' }
  // Space SELECT RLS checks membership, but AFTER INSERT triggers create that membership.
  // INSERT ... RETURNING sees the row before AFTER triggers and is rejected by RLS.
  // Generate the UUID on the server, insert without RETURNING, then let the committed
  // triggers create membership, participant, wallet and official collections.
  const spaceId = randomUUID()
  const { error } = await supabase.from('spaces')
    .insert({ id: spaceId, kind, name, timezone, owner_id: user.id })
  if (error) return { status:'error', message:'สร้างพื้นที่ไม่สำเร็จ โปรดลองอีกครั้ง' }
  revalidatePath('/spaces')
  revalidatePath('/rooms')
  return { status:'success', message:'สร้างพื้นที่เรียบร้อยแล้ว', spaceId }
}

export async function updateSpaceAction(_state: SpaceState, form: FormData): Promise<SpaceState> {
  const id = field(form, 'space_id')
  const name = field(form, 'name')
  const timezone = field(form, 'timezone')
  if (!isUuid(id)) return { status:'error', message:'พื้นที่ไม่ถูกต้อง' }
  if (name.length < 1 || name.length > 100) return { status:'error', message:'ชื่อพื้นที่ต้องยาว 1–100 ตัวอักษร' }
  if (!allowedTimezone(timezone)) return { status:'error', message:'เขตเวลาไม่ถูกต้อง' }
  const { user, space, supabase } = await getSpaceContext(id)
  if (space.owner_id !== user.id) return { status:'error', message:'เจ้าของพื้นที่เท่านั้นที่แก้ไขข้อมูลได้' }
  const { data, error } = await supabase.from('spaces').update({ name, timezone })
    .eq('id', id).eq('owner_id',user.id).select('id').maybeSingle()
  if (error || !data) return { status:'error', message:'ไม่สามารถแก้ไขพื้นที่ได้' }
  revalidatePath('/spaces')
  revalidatePath('/s/' + id)
  revalidatePath('/s/' + id + '/settings')
  return { status:'success', message:'บันทึกการเปลี่ยนแปลงแล้ว' }
}
