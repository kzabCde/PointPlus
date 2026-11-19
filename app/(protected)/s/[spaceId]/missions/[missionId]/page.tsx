import type { Metadata } from 'next'
import Link from 'next/link'
import { getMissionDetail, frequencyLabels, statusLabels, modeLabels, windowState } from '@/features/missions/data'
export const metadata: Metadata = { title: 'รายละเอียดภารกิจ' }
export default async function MissionDetailPage({ params, searchParams }: {
  params: Promise<{ spaceId: string; missionId: string }>
  searchParams: Promise<{ participant?: string }>
}) {
  const { spaceId, missionId } = await params
  const { participant } = await searchParams
  const { mission, selected, space, campaigns, stampCards, manager } = await getMissionDetail(spaceId,missionId,participant)
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
      <p className="muted">ระบบส่งงานและอนุมัติภารกิจจะเพิ่มใน Phase 2</p>
    </div>
  </>
}
