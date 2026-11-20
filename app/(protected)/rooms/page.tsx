import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SectionHeader } from '@/components/ui/section-header'
import { roomArt, roomKindLabels, roomRoleLabels } from '@/features/rooms/presentation'
import { ResumeRoom } from '@/features/rooms/room-usage'
import { requireUser } from '@/lib/auth/session'
import { listMyRooms, listMySpaces } from '@/features/spaces/data'
import { CreateSpaceForm } from '@/features/spaces/space-form'

export const metadata: Metadata = { title: 'ห้องของฉัน' }
export default async function RoomsPage() {
  // Only membership + Room metadata: do not fetch missions/wallets at login.
  const [rooms, spaces, { user }] = await Promise.all([listMyRooms(), listMySpaces(), requireUser()])
  const personal = spaces.filter(space => space.kind === 'personal')
  const destinations = [...rooms, ...personal]
  return <section className="room-launcher">
    <SectionHeader title="ห้องของฉัน" heading="h1"/>
    {destinations.length > 0 && <ResumeRoom accountId={user.id} rooms={destinations} />}
    {destinations.length > 0 && <section aria-label="ห้องของคุณ" className="room-cards">
      {destinations.map(room => <Link href={'/s/' + room.id} className="room-card" data-kind={room.kind} key={room.id}>
        <span className="room-card__art"><Image src={roomArt[room.kind]} height={64} width={64} alt=""/></span>
        <span className="room-card__content"><span className="room-meta">{roomKindLabels[room.kind]} · {roomRoleLabels[room.role]}</span><strong>{room.name}</strong>
        <span className="muted">เข้าห้อง</span></span>
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
