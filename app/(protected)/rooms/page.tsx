import type { Metadata } from 'next'
import Link from 'next/link'
import { listMyRooms } from '@/features/spaces/data'
import { CreateSpaceForm } from '@/features/spaces/space-form'

export const metadata: Metadata = { title: 'ห้องของฉัน' }
const roomLabels = { couple: 'คู่รัก', family: 'ครอบครัว', group: 'ทั่วไป' } as const
export default async function RoomsPage() {
  // Only membership + Room metadata: do not fetch missions/wallets at login.
  const rooms = await listMyRooms()
  return <section className="room-launcher">
    <span className="eyebrow">POINT+ ROOMS</span>
    <h1 className="page-title">ห้องของฉัน</h1>
    <p className="muted">สร้างพื้นที่เล็ก ๆ สำหรับคนสำคัญ หรือกลับไปทำกิจกรรมในห้องที่คุณเข้าร่วม</p>
    {rooms.length > 0 && <section aria-label="ห้องที่เข้าร่วม" className="room-cards">
      {rooms.map(room => <Link href={'/s/' + room.id} className="room-card" key={room.id}>
        <span className="room-card__art" aria-hidden="true">{room.kind === 'couple' ? '♥' : room.kind === 'family' ? '⌂' : '✦'}</span>
        <span className="room-card__content"><span className="eyebrow">{roomLabels[room.kind as keyof typeof roomLabels]}</span><strong>{room.name}</strong>
        <span className="muted">แตะเพื่อเข้าห้อง</span></span>
        <span aria-hidden="true">›</span>
      </Link>)}
    </section>}
    {!rooms.length && <div className="card empty-state">
      <h2>ยังไม่มีห้องร่วมกัน</h2>
      <p>เลือกประเภทห้องแล้วเชิญคนสำคัญเข้ามา หรือเปิดลิงก์คำเชิญที่ได้รับ</p>
      <Link className="button button--secondary" href="/join">ฉันมีลิงก์คำเชิญ</Link>
    </div>}
    <details className="room-create" open={!rooms.length}>
      <summary>{rooms.length ? '+ สร้างห้องเพิ่ม' : 'สร้างห้องแรกของคุณ'}</summary>
      <CreateSpaceForm />
    </details>
    {!!rooms.length && <p className="muted room-launcher__footer">มีลิงก์คำเชิญ? <Link className="text-link" href="/join">เข้าร่วมห้องของคนสำคัญ</Link></p>}
  </section>
}
