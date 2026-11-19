'use server'

import { revalidatePath } from 'next/cache'
import { canManage, getSpaceContext } from '@/features/spaces/data'
import { field, isUuid } from '@/lib/auth/validation'

export type RewardState = { status: 'idle' | 'success' | 'error'; message: string }
const fail = (message: string): RewardState => ({ status: 'error', message })
const int = (text: string, max: number) => {
  if (!/^\d{1,10}$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null
}

export async function createRewardAction(_previous: RewardState, form: FormData): Promise<RewardState> {
  const spaceId = field(form, 'space_id')
  const title = field(form, 'title')
  const description = field(form, 'description')
  const cost = int(field(form, 'cost_points'), 1000000000)
  if (!isUuid(spaceId)) return fail('ห้องไม่ถูกต้อง')
  if (!title || title.length > 160 || description.length > 4000 || cost === null || cost < 1)
    return fail('กรุณาตรวจสอบชื่อ รายละเอียด และแต้มที่ใช้แลก')
  const { supabase, user, member } = await getSpaceContext(spaceId)
  if (!canManage(member.role)) return fail('เฉพาะผู้ดูแลห้องที่สร้างรางวัลได้')
  const { error } = await supabase.from('rewards').insert({
    space_id: spaceId, created_by: user.id, title, description: description || null,
    cost_points: cost, stock_remaining: null, status: 'active',
  })
  if (error) return fail('สร้างรางวัลไม่สำเร็จ โปรดตรวจสอบสิทธิ์และลองอีกครั้ง')
  revalidatePath('/s/' + spaceId + '/rewards')
  return { status: 'success', message: 'เพิ่มรางวัลส่วนตัวแล้ว' }
}

export async function redeemRewardAction(_previous: RewardState, form: FormData): Promise<RewardState> {
  const spaceId = field(form, 'space_id')
  const rewardId = field(form, 'reward_id')
  const participantId = field(form, 'participant_id')
  const key = field(form, 'idempotency_key')
  if (![spaceId, rewardId, participantId].every(isUuid) || !/^[a-f\d-]{36}$/i.test(key))
    return fail('ข้อมูลการแลกไม่ถูกต้อง')
  const { supabase } = await getSpaceContext(spaceId)
  // Validate client-provided IDs belong to the current Room before calling
  // the authoritative, atomic database RPC; do not trust hidden form fields.
  const [reward, participant] = await Promise.all([
    supabase.from('rewards').select('id').eq('space_id',spaceId).eq('id',rewardId).maybeSingle(),
    supabase.from('participants').select('id').eq('space_id',spaceId)
      .eq('id',participantId).is('archived_at',null).maybeSingle(),
  ])
  if (reward.error || participant.error || !reward.data || !participant.data)
    return fail('รางวัลหรือผู้เข้าร่วมไม่อยู่ในห้องนี้')
  // Atomic point subtraction and eligibility live ONLY in database v2 RPC.
  const { error } = await supabase.rpc('pointplus_redeem_reward', {
    p_reward: rewardId, p_participant: participantId, p_idempotency_key: key,
  })
  if (error) return fail('แลกรางวัลไม่สำเร็จ อาจมีแต้มไม่พอหรือรางวัลไม่พร้อมใช้งาน')
  revalidatePath('/s/' + spaceId + '/rewards')
  return { status: 'success', message: 'ส่งคำขอแลกรางวัลสำเร็จ' }
}

export async function processRedemptionAction(_previous: RewardState, form: FormData): Promise<RewardState> {
  const spaceId = field(form, 'space_id')
  const redemptionId = field(form, 'redemption_id')
  const decision = field(form, 'decision')
  if (!isUuid(spaceId) || !isUuid(redemptionId) || !['fulfill', 'cancel'].includes(decision))
    return fail('รายการไม่ถูกต้อง')
  const { supabase } = await getSpaceContext(spaceId)
  const { data: redemption, error: scopeError } = await supabase.from('redemptions')
    .select('id').eq('space_id',spaceId).eq('id',redemptionId).maybeSingle()
  if (scopeError || !redemption) return fail('ไม่พบการแลกรางวัลในห้องนี้')
  const { error } = decision === 'fulfill'
    ? await supabase.rpc('pointplus_fulfill_redemption', { p_redemption: redemptionId, p_note: null })
    : await supabase.rpc('pointplus_cancel_redemption', { p_redemption: redemptionId, p_note: null })
  if (error) return fail('ดำเนินการไม่สำเร็จ โปรดตรวจสอบสิทธิ์หรือสถานะรายการ')
  revalidatePath('/s/' + spaceId + '/rewards')
  return { status: 'success', message: decision === 'fulfill' ? 'บันทึกการส่งมอบแล้ว' : 'ยกเลิกและคืนแต้มเรียบร้อยแล้ว' }
}
