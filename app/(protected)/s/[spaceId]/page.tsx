import Link from 'next/link'
import { getSpaceContext, getSpaceMembers, getSpaceParticipants, canManage } from '@/features/spaces/data'
import { loadMissionBoard, windowState } from '@/features/missions/data'

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ member, space }, members, participants, board] = await Promise.all([
    getSpaceContext(spaceId), getSpaceMembers(spaceId), getSpaceParticipants(spaceId),
    loadMissionBoard(spaceId, { status: 'active' }),
  ])
  const active = board.missions.filter(m => m.status === 'active')
  return <div className="card">
    <h2>ภาพรวมพื้นที่</h2>
    <p className="muted">บทบาทของคุณ: {member.role}</p>
    <div className="dashboard-stats">
      <div><strong>{members.length}</strong><span>สมาชิกบัญชี</span></div>
      <div><strong>{participants.length}</strong><span>ผู้เข้าร่วมที่มองเห็น</span></div>
      <div><strong>{active.length}</strong><span>ภารกิจเปิดใช้งานที่มองเห็น</span></div>
      <div><strong>{active.filter(m => windowState(m) === 'available').length}</strong><span>อยู่ในช่วงเวลาของภารกิจ</span></div>
    </div>
    <div className="hero__actions">
      <Link href={'/s/' + spaceId + '/missions'} className="button button--primary">ดูภารกิจ</Link>
      {canManage(member.role) && <Link href={'/s/' + spaceId + '/missions/new'} className="button button--secondary">สร้างภารกิจใหม่</Link>}
      {canManage(member.role) && <Link href={'/s/' + spaceId + '/campaigns'} className="text-link">ชุดภารกิจ</Link>}
      {space.kind === 'family' && <Link href={'/s/' + spaceId + '/children'} className="text-link">เด็กในครอบครัว</Link>}
    </div>
    <p className="muted" style={{ marginTop: 16 }}>ข้อมูลอิงสิทธิ์ของพื้นที่ ไม่ใช่ข้อมูลจำลอง</p>
  </div>
}
