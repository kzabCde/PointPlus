import type { Metadata } from 'next'
import Link from 'next/link'
import { frequencyLabels, statusLabels, modeLabels, windowState } from '@/features/missions/data'
import { loadMissionSubmissions, loadPointLedger, availabilityLabels } from '@/features/social/data'
import { SubmissionForm } from '@/features/social/submission-form'
import { PrivateEvidence } from '@/features/social/private-evidence'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata: Metadata = { title: 'รายละเอียดภารกิจ' }
export default async function MissionDetailPage({ params, searchParams }: {
  params: Promise<{ spaceId: string; missionId: string }>
  searchParams: Promise<{ participant?: string }>
}) {
  const { spaceId, missionId } = await params
  const { participant } = await searchParams
  const activity = await loadMissionSubmissions(spaceId,missionId,participant)
  const {mission, selected,space,campaigns,stampCards,manager,submissions,availability,canSubmit} = activity
  const ledger = await loadPointLedger(spaceId,selected!.id)
  const formatDate = (value: string) => new Intl.DateTimeFormat('th-TH',{
    dateStyle: 'medium', timeStyle: 'short', timeZone: space.timezone,
  }).format(new Date(value))
  const timeWindow = windowState(mission)
  return <>
    <Link className="text-link" href={'/s/' + spaceId + '/missions?participant=' + selected!.id}>← กลับไปหน้าภารกิจ</Link>
    <div className="space-header"><h2 className="page-title">{mission.title}</h2>{manager && <Link className="button button--primary" href={'/s/'+spaceId+'/missions/'+missionId+'/manage'}>จัดการภารกิจ</Link>}</div>
    <div className="card">
      <p>สถานะ: {statusLabels[mission.status]} · ความถี่: {frequencyLabels[mission.frequency]}</p>
      <p>ผู้เข้าร่วม: {selected!.display_name}</p>
      <p>การมอบหมาย: {modeLabels[mission.assignment_mode]}</p>
      <p>{mission.description ?? 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
      <p>แต้มเมื่อผ่านอนุมัติ: {mission.points_reward} · แสตมป์: {mission.stamps_reward}</p>
      {mission.max_completions !== null && <p>จำนวนครั้งสูงสุด: {mission.max_completions}</p>}
      {mission.campaign_id && <p>ชุดภารกิจ: {campaigns.find(c => c.id === mission.campaign_id)?.title ?? 'ไม่พบชื่อ'}</p>}
      {mission.stamp_card_id && <p>บัตรแสตมป์: {stampCards.find(c => c.id === mission.stamp_card_id)?.title ?? 'ไม่พบชื่อ'}</p>}
      {mission.starts_at && <p>เริ่ม: {formatDate(mission.starts_at)}</p>}
      {mission.ends_at && <p>สิ้นสุด: {formatDate(mission.ends_at)}</p>}
      {mission.status === 'active' && <p className="muted">{timeWindow === 'available' ? 'อยู่ในช่วงเวลาที่กำหนด' : timeWindow === 'upcoming' ? 'ยังไม่เริ่ม' : 'สิ้นสุดแล้ว'}</p>}
      <p className="muted" role="status">{availabilityLabels[availability]}</p>
    </div>
    <RefreshControl/>
    {canSubmit && availability === 'available' &&
      <SubmissionForm spaceId={spaceId} missionId={missionId} participantId={selected!.id}/>}
    <section className="card"><h3>แต้มของ {selected!.display_name}</h3>
      <p>คงเหลือ {ledger.wallet?.balance ?? '—'} · แต้มที่ได้รับสะสม {ledger.wallet?.lifetime_earned ?? '—'}</p>
      {ledger.transactions.length>0 && <details><summary>ดูรายการแต้มล่าสุด</summary><ul>
        {ledger.transactions.map(t=><li key={t.id}>{formatDate(t.created_at)} · {t.amount>0?'+':''}{t.amount} แต้ม ({t.source_type})</li>)}
      </ul></details>}
    </section>
    <section className="social-stack"><h3>ประวัติการส่งภารกิจ</h3>
      {submissions.length === 0 && <p className="muted">ยังไม่มีการส่งภารกิจนี้</p>}
      {submissions.map(item=><article className="card" key={item.id}>
        <p><strong>{item.status === 'submitted' ? 'รอตรวจ' : item.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}</strong> · {formatDate(item.submitted_at)}</p>
        {item.proof_text && <p className="social-proof">{item.proof_text}</p>}
        {item.proof_path && <PrivateEvidence path={item.proof_path}/>}
        {item.review_note && <p>เหตุผลผู้ตรวจ: {item.review_note}</p>}
      </article>)}
    </section>
  </>
}
