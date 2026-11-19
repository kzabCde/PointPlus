'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { createRewardAction, redeemRewardAction, processRedemptionAction, type RewardState } from './actions'

const initial: RewardState = { status: 'idle', message: '' }

export function CreateRewardForm({ spaceId }: { spaceId: string }) {
  const [state, action, pending] = useActionState(createRewardAction, initial)
  return <form action={action} className="card social-form">
    <h3>เพิ่มรางวัลภายในห้อง</h3>
    <p className="muted">รางวัลส่วนตัวที่สมาชิกตกลงกัน ไม่มีเงินสดหรือสิ่งตอบแทนเชิงพาณิชย์</p>
    <input type="hidden" name="space_id" value={spaceId} />
    <label htmlFor="reward-title">ชื่อรางวัล</label>
    <input id="reward-title" className="input" name="title" maxLength={160} required placeholder="เช่น เลือกหนังที่อยากดูด้วยกัน" />
    <label htmlFor="reward-desc">รายละเอียด (ไม่บังคับ)</label>
    <textarea id="reward-desc" name="description" className="input" maxLength={4000} />
    <label htmlFor="reward-cost">แต้มที่ใช้แลก</label>
    <input id="reward-cost" name="cost_points" className="input" type="number" min={1} max={1000000000} step={1} required />
    <Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'เพิ่มรางวัล'}</Button>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
  </form>
}

export function RedeemRewardButton({ spaceId, rewardId, participantId, keyId }: {
  spaceId: string; rewardId: string; participantId: string; keyId: string
}) {
  const [state, action, pending] = useActionState(redeemRewardAction, initial)
  return <form action={action} className="social-form">
    <input type="hidden" name="space_id" value={spaceId} />
    <input type="hidden" name="reward_id" value={rewardId} />
    <input type="hidden" name="participant_id" value={participantId} />
    <input type="hidden" name="idempotency_key" value={keyId} />
    <Button type="submit" disabled={pending || state.status === 'success'}>{pending ? 'กำลังแลก…' : 'แลกรางวัล'}</Button>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
  </form>
}

export function ProcessRedemptionForm({ spaceId, redemptionId, canFulfill }: {
  spaceId: string; redemptionId: string; canFulfill: boolean
}) {
  const [state, action, pending] = useActionState(processRedemptionAction, initial)
  return <form action={action} className="hero__actions">
    <input type="hidden" name="space_id" value={spaceId} />
    <input type="hidden" name="redemption_id" value={redemptionId} />
    {canFulfill && <Button type="submit" name="decision" value="fulfill" disabled={pending || state.status === 'success'}>ส่งมอบแล้ว</Button>}
    <Button type="submit" name="decision" value="cancel" variant="secondary" disabled={pending || state.status === 'success'}>ยกเลิกและคืนแต้ม</Button>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
  </form>
}
