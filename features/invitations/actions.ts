'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { field, isUuid } from '@/lib/auth/validation'
import { siteOrigin } from '@/lib/auth/redirects'
import { canManage, getSpaceContext } from '@/features/spaces/data'

export type InviteState = {
  status: 'idle' | 'error' | 'success'
  message: string
  link?: string
}
export type JoinState = {
  status: 'idle' | 'error' | 'success' | 'login'
  message: string
  spaceId?: string
}

export async function createInviteAction(_state: InviteState, form: FormData): Promise<InviteState> {
  const id = field(form, 'space_id')
  const role = field(form, 'role')
  const rawDays = field(form, 'days')
  const days = Number(rawDays)
  if (!isUuid(id) || !['admin', 'member'].includes(role) ||
    !/^\d{1,2}$/.test(rawDays) || !Number.isInteger(days) || days < 1 || days > 30)
    return { status: 'error', message: 'กรุณาตรวจสอบบทบาทและอายุลิงก์ (1–30 วัน)' }

  const { supabase, member, space } = await getSpaceContext(id)
  if (space.kind === 'personal' || !canManage(member.role) || (role === 'admin' && member.role !== 'owner'))
    return { status: 'error', message: 'คุณไม่มีสิทธิ์ส่งคำเชิญในลักษณะนี้' }

  // The token is only returned once by the database. Never log or persist it.
  const { data, error } = await supabase.rpc('pointplus_create_invite', {
    p_space: id, p_role: role, p_days: days,
  })
  if (error || typeof data !== 'string' || !/^[a-f0-9]{64}$/i.test(data))
    return { status: 'error', message: 'สร้างคำเชิญไม่สำเร็จ โปรดตรวจสอบสิทธิ์และลองอีกครั้ง' }
  // URL fragment is never sent to the server in page requests/referrer headers.
  return {
    status: 'success',
    message: 'สร้างลิงก์เชิญแล้ว โปรดส่งให้ผู้ที่ต้องการเชิญโดยตรง',
    link: siteOrigin() + '/join#token=' + data,
  }
}

export async function acceptInviteAction(_state: JoinState, form: FormData): Promise<JoinState> {
  const token = field(form, 'token')
  if (!/^[a-f0-9]{64}$/i.test(token))
    return { status: 'error', message: 'ลิงก์เชิญไม่ถูกต้อง' }
  const { supabase, user } = await (async () => {
    // Unlike normal protected actions, an anonymous user should get a
    // helpful "sign in then reopen your invite" state instead of a redirect.
    const { createClient } = await import('@/utils/supabase/server')
    const client = await createClient()
    const { data } = await client.auth.getUser()
    return { supabase: client, user: data.user }
  })()
  if (!user) return { status: 'login', message: 'โปรดเข้าสู่ระบบ แล้วเปิดลิงก์คำเชิญฉบับเดิมอีกครั้ง' }
  const { data, error } = await supabase.rpc('pointplus_accept_invite', { p_token: token })
  if (error || typeof data !== 'string' || !isUuid(data))
    return { status: 'error', message: 'ไม่สามารถเข้าร่วมได้ ลิงก์อาจหมดอายุ ใช้ครบแล้ว หรือพื้นที่มีสมาชิกเต็ม' }
  revalidatePath('/spaces')
  revalidatePath('/s/' + data)
  return { status: 'success', message: 'เข้าร่วมพื้นที่เรียบร้อยแล้ว', spaceId: data }
}
