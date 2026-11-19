import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { canManage, getSpaceContext, getSpaceParticipants } from '@/features/spaces/data'
import { CreateRewardForm, RedeemRewardButton, ProcessRedemptionForm } from '@/features/rewards/forms'

export const metadata: Metadata = { title: 'รางวัลภายในห้อง' }

export default async function RewardsPage({ params, searchParams }: {
  params: Promise<{ spaceId: string }>
  searchParams: Promise<{ participant?: string }>
}) {
  const { spaceId } = await params
  const { participant: requested } = await searchParams
  const [{ user, supabase, member }, people] = await Promise.all([
    getSpaceContext(spaceId), getSpaceParticipants(spaceId),
  ])
  const manager = canManage(member.role)
  const eligible = people.filter(p => manager || p.user_id === user.id ||
    (p.kind === 'child' && p.guardian_user_id === user.id))
  const selected = eligible.find(p => p.id === requested)
    ?? eligible.find(p => p.user_id === user.id) ?? eligible[0] ?? null
  const [catalog, history, wallet] = await Promise.all([
    supabase.from('rewards').select('id,title,description,cost_points,stock_remaining')
      .eq('space_id',spaceId).eq('status','active').order('created_at',{ascending:false}).limit(30),
    selected ? supabase.from('redemptions').select('id,reward_id,status,cost_snapshot,requested_at')
      .eq('space_id',spaceId).eq('participant_id',selected.id).order('requested_at',{ascending:false}).limit(30)
      : Promise.resolve({data:[],error:null}),
    selected ? supabase.from('point_wallets').select('balance')
      .eq('space_id',spaceId).eq('participant_id',selected.id).maybeSingle()
      : Promise.resolve({data:null,error:null}),
  ])
  if (catalog.error || history.error || wallet.error)
    throw new Error('Cannot load authorized Room rewards')
  const names = new Map((catalog.data ?? []).map(x => [x.id,x.title]))
  return <section className="social-stack">
    <div><span className="eyebrow">POINT+ REWARDS</span>
      <h2 className="page-title">รางวัลของห้อง</h2>
      <p className="muted">แลกแต้มที่ได้รับจากกิจกรรมเป็นรางวัลส่วนตัวที่ตกลงกันภายในห้อง</p></div>
    {eligible.length > 1 && <form method="get" className="card social-form">
      <label htmlFor="reward-participant">ดูรางวัลของ</label>
      <select name="participant" id="reward-participant" className="input" defaultValue={selected?.id ?? ''}>
        {eligible.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select><button type="submit" className="button button--secondary">ดูข้อมูล</button>
    </form>}
    <div className="card"><p className="muted">แต้มคงเหลือของ {selected?.display_name ?? 'ผู้เข้าร่วม'}</p>
      <strong className="reward-balance">{wallet.data?.balance == null ? '—' : wallet.data.balance.toLocaleString('th-TH')}</strong></div>
    <h3>รางวัลที่แลกได้</h3>
    {!catalog.data?.length && <div className="card">ห้องนี้ยังไม่มีรางวัลที่เปิดใช้งาน</div>}
    <div className="room-cards">{(catalog.data ?? []).map(reward => <article className="card" key={reward.id}>
      <h3>{reward.title}</h3>
      <p className="muted">{reward.description || 'รางวัลส่วนตัวในห้อง'}</p>
      <p><strong>{reward.cost_points.toLocaleString('th-TH')} แต้ม</strong></p>
      {reward.stock_remaining === 0
        ? <span className="status status--warning">รางวัลหมด</span>
        : selected && <RedeemRewardButton spaceId={spaceId} rewardId={reward.id}
          participantId={selected.id} keyId={randomUUID()} />}
    </article>)}</div>
    <h3>ประวัติการแลก</h3>
    {!history.data?.length && <div className="card">ยังไม่มีประวัติการแลกรางวัล</div>}
    {(history.data ?? []).map(item => <article className="card" key={item.id}>
      <strong>{names.get(item.reward_id) ?? 'รางวัลที่ไม่ได้อยู่ในรายการปัจจุบัน'}</strong>
      <p className="muted">{item.cost_snapshot} แต้ม · {item.status === 'requested' ? 'รอดำเนินการ' : item.status === 'fulfilled' ? 'ส่งมอบแล้ว' : 'ยกเลิก'}</p>
      {item.status === 'requested' && selected && <ProcessRedemptionForm spaceId={spaceId}
        redemptionId={item.id} canFulfill={manager} />}
    </article>)}
    {manager && <CreateRewardForm spaceId={spaceId} />}
  </section>
}
