import Link from 'next/link'
import type { Mission } from './data'
import { frequencyLabels, modeLabels, statusLabels, windowState } from './data'
export function MissionCard({ mission, spaceId, participantId }: {
  mission: Mission; spaceId: string; participantId: string
}) {
  const window = windowState(mission)
  return <article className="feature-card mission-card">
    <p className="muted"><strong>{statusLabels[mission.status]}</strong> · {frequencyLabels[mission.frequency]}</p>
    <h3>{mission.title}</h3>
    <p>{mission.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
    <p>ประเภท: {modeLabels[mission.assignment_mode]}</p>
    {mission.status === 'active' && <p className="muted">{window === 'available' ? 'อยู่ในช่วงเวลาของภารกิจ' :
      window === 'upcoming' ? 'ยังไม่ถึงเวลาเริ่ม' : 'สิ้นสุดช่วงเวลาแล้ว'}</p>}
    <p className="muted">แต้ม: {mission.points_reward} · แสตมป์: {mission.stamps_reward}</p>
    <Link className="button button--secondary"
      href={'/s/' + spaceId + '/missions/' + mission.id + '?participant=' + encodeURIComponent(participantId)}>
      ดูรายละเอียด
    </Link>
  </article>
}
