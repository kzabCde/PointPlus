import Link from 'next/link'
import { getSpaceContext, canManage } from '@/features/spaces/data'
import { loadMissionBoard } from '@/features/missions/data'

export default async function RoomHomePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ space, member }, board] = await Promise.all([
    getSpaceContext(spaceId),
    loadMissionBoard(spaceId, { status: 'active' }),
  ])
  const recent = board.missions.slice(0, 4)
  const path = '/s/' + spaceId
  return <div className="room-home">
    <section className="room-hero">
      <span className="eyebrow">วันนี้ในห้องของเรา</span>
      <h2>มาทำสิ่งดี ๆ ด้วยกัน</h2>
      <p>กิจกรรมของห้องนี้เท่านั้น — ทุกความสำเร็จเริ่มจากเรื่องเล็ก ๆ</p>
      <div className="hero__actions">
        {canManage(member.role) && <Link href={path + '/missions/new'} className="button button--primary">+ สร้างกิจกรรม</Link>}
        <Link href={path + '/missions'} className="button button--secondary">ดูกิจกรรมทั้งหมด</Link>
      </div>
    </section>
    <div className="room-summary">
      <Link href={path + '/missions'} className="room-summary__tile"><strong>{board.missions.length}</strong><span>กิจกรรมที่มองเห็น</span></Link>
      <Link href={path + '/reviews'} className="room-summary__tile"><strong>↗</strong><span>รายการรออนุมัติ</span></Link>
      <Link href={path + '/collection'} className="room-summary__tile"><strong>★</strong><span>สมุดสะสม</span></Link>
    </div>
    <div className="space-header"><h2>กิจกรรมของเรา</h2><Link className="text-link" href={path + '/missions'}>ดูทั้งหมด</Link></div>
    {recent.length
      ? <div className="room-activity-list">{recent.map(m => <Link href={path + '/missions/' + m.id} key={m.id} className="room-activity-item">
          <span><strong>{m.title}</strong><small>{m.description || 'กิจกรรมร่วมกันในห้อง'}</small></span><span aria-hidden="true">›</span>
        </Link>)}</div>
      : <div className="card empty-state"><h3>ยังไม่มีกิจกรรมที่เปิดใช้งาน</h3>
          <p>ลองสร้างกิจกรรมสั้น ๆ แล้วชวนสมาชิกเริ่มทำด้วยกัน</p>
          {canManage(member.role) && <Link href={path + '/missions/new'} className="button button--primary">สร้างกิจกรรมแรก</Link>}
        </div>}
    <div className="room-shortcuts">
      <Link href={path + '/daily'}>กิจกรรมวันนี้</Link>
      <Link href={path + '/shared'}>กิจกรรมร่วมกัน</Link>
      <Link href={path + '/rewards'}>รางวัลในห้อง</Link>
      <Link href={path + '/progress'}>ความคืบหน้า</Link>
      {space.kind === 'family' && <Link href={path + '/children'}>เด็กในครอบครัว</Link>}
      {canManage(member.role) && <Link href={path + '/campaigns'}>ชุดภารกิจ</Link>}
    </div>
  </div>
}
