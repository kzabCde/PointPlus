'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { allowedTimezone, field } from '@/lib/auth/validation'

export type ProfileState = { status: 'idle' | 'success' | 'error'; message: string }

export async function saveProfileAction(_state: ProfileState, form: FormData): Promise<ProfileState> {
  const displayName = field(form, 'display_name')
  const locale = field(form, 'locale')
  const timezone = field(form, 'timezone')
  if (displayName.length < 1 || displayName.length > 80)
    return { status: 'error', message: 'ชื่อที่แสดงต้องยาว 1–80 ตัวอักษร' }
  if (locale !== 'th' && locale !== 'en')
    return { status: 'error', message: 'กรุณาเลือกภาษาไทยหรือภาษาอังกฤษ' }
  if (!allowedTimezone(timezone))
    return { status: 'error', message: 'เขตเวลาไม่ถูกต้อง' }
  const { user, supabase } = await requireUser()
  const { data, error } = await supabase.from('profiles')
    .update({ display_name: displayName, locale, timezone })
    .eq('id', user.id).select('id').maybeSingle()
  if (error || !data)
    return { status: 'error', message: 'บันทึกไม่ได้ กรุณาตรวจสอบสิทธิ์หรือข้อมูลโปรไฟล์' }
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  revalidatePath('/onboarding')
  return { status: 'success', message: 'บันทึกโปรไฟล์แล้ว' }
}
